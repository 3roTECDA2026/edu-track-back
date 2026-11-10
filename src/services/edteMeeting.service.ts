import { PendingSubjectStatus, Prisma, type Shift } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { ListEdteMeetingsQuery } from '@/schemas/edteMeeting.schema'
import { HttpError } from '@/utils/httpError'
import { toDay } from '@/utils/schoolDate'

// Reuniones del EDTE (E4-RF-03, CRM-075): fecha, período, integrantes convocados, alumnos
// tratados y consideraciones. Se editan solo en borrador.

const personSelect = { select: { id: true, firstName: true, lastName: true } } as const
const studentSelect = {
  select: { id: true, firstName: true, lastName: true, dni: true },
} as const

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.lastName}, ${person.firstName}`

const summaryInclude = {
  academicYear: { select: { id: true, year: true } },
  members: { select: { present: true } },
  _count: { select: { students: true } },
} satisfies Prisma.EdteMeetingInclude

type MeetingSummary = Prisma.EdteMeetingGetPayload<{ include: typeof summaryInclude }>

const detailInclude = {
  academicYear: { select: { id: true, year: true } },
  createdBy: personSelect,
  signedBy: personSelect,
  members: {
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  },
  students: {
    include: { student: studentSelect },
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  },
  // PATE armados en la reunión (CRM-078), para el acceso desde el detalle
  pates: { select: { id: true, studentId: true, status: true } },
} satisfies Prisma.EdteMeetingInclude

type MeetingDetail = Prisma.EdteMeetingGetPayload<{ include: typeof detailInclude }>

function toMeetingSummary(meeting: MeetingSummary) {
  return {
    id: meeting.id,
    year: meeting.academicYear.year,
    date: toDay(meeting.date),
    period: meeting.period,
    shift: meeting.shift,
    status: meeting.status,
    minutesUrl: meeting.minutesUrl,
    membersCount: meeting.members.length,
    presentCount: meeting.members.filter((member) => member.present).length,
    studentsCount: meeting._count.students,
    signedAt: meeting.signedAt,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  }
}

type SectionInfo = { id: string; grade: number; division: string; shift: Shift }

// Sección actual de cada alumno en el ciclo (inscripción abierta a una división)
async function currentSectionsByStudent(
  studentIds: string[],
  academicYearId: string
): Promise<Map<string, SectionInfo>> {
  if (studentIds.length === 0) return new Map()
  const records = await prisma.enrollmentHistory.findMany({
    where: { studentId: { in: studentIds }, endDate: null, classSection: { academicYearId } },
    select: {
      studentId: true,
      classSection: { select: { id: true, grade: true, division: true, shift: true } },
    },
  })
  return new Map(records.map((record) => [record.studentId, record.classSection]))
}

// Cantidad de MPAA pendientes de cada alumno
async function pendingCountByStudent(studentIds: string[]) {
  if (studentIds.length === 0) return new Map<string, number>()
  const groups = await prisma.pendingSubject.groupBy({
    by: ['studentId'],
    where: { studentId: { in: studentIds }, status: PendingSubjectStatus.PENDING },
    _count: { _all: true },
  })
  return new Map(groups.map((group) => [group.studentId, group._count._all]))
}

async function toMeetingDetail(meeting: MeetingDetail) {
  const studentIds = meeting.students.map((item) => item.studentId)
  const [sections, pendingCounts] = await Promise.all([
    currentSectionsByStudent(studentIds, meeting.academicYearId),
    pendingCountByStudent(studentIds),
  ])

  return {
    ...toMeetingSummary({
      ...meeting,
      _count: { students: meeting.students.length },
    }),
    considerations: meeting.considerations,
    createdBy: meeting.createdBy
      ? { id: meeting.createdBy.id, name: fullName(meeting.createdBy) }
      : null,
    signedBy: meeting.signedBy
      ? { id: meeting.signedBy.id, name: fullName(meeting.signedBy) }
      : null,
    members: meeting.members.map((member) => ({
      userId: member.userId,
      name: fullName(member.user),
      role: member.user.role,
      // Rol con el que participó, guardado al cargar la reunión (no cambia si cambia el usuario)
      roleInMeeting: member.roleInMeeting,
      present: member.present,
    })),
    students: meeting.students.map((item) => {
      const pate = meeting.pates.find((plan) => plan.studentId === item.studentId)
      return {
        studentId: item.studentId,
        firstName: item.student.firstName,
        lastName: item.student.lastName,
        dni: item.student.dni,
        section: sections.get(item.studentId) ?? null,
        pendingSubjectsCount: pendingCounts.get(item.studentId) ?? 0,
        notes: item.notes,
        pate: pate ? { id: pate.id, status: pate.status } : null,
      }
    }),
  }
}

async function findMeetingOrFail(id: string) {
  const meeting = await prisma.edteMeeting.findUnique({ where: { id }, include: detailInclude })
  if (!meeting) throw new HttpError(404, 'Reunión del EDTE no encontrada')
  return meeting
}

// Listado, de la más reciente a la más vieja
export async function listEdteMeetings(query: ListEdteMeetingsQuery) {
  const meetings = await prisma.edteMeeting.findMany({
    where: {
      ...(query.year !== undefined && { academicYear: { year: query.year } }),
      ...(query.period && { period: query.period }),
      ...(query.status && { status: query.status }),
    },
    include: summaryInclude,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })
  return meetings.map(toMeetingSummary)
}

// Detalle: integrantes convocados, alumnos tratados y el PATE de cada uno (si lo tiene)
export async function getEdteMeeting(id: string) {
  return toMeetingDetail(await findMeetingOrFail(id))
}
