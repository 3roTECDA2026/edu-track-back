import {
  AuditActionType,
  EdteMeetingPeriod,
  EdteMeetingStatus,
  PateStatus,
  PendingSubjectStatus,
  Prisma,
  Role,
  type Shift,
  StudentStatus,
  UserStatus,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateEdteMeetingInput,
  EdteMeetingCandidatesQuery,
  ListEdteMeetingsQuery,
  UpdateEdteMeetingInput,
} from '@/schemas/edteMeeting.schema'
import { HttpError } from '@/utils/httpError'
import { toDate, toDay, todayInSchoolTimeZone } from '@/utils/schoolDate'

// Reuniones del EDTE (E4-RF-03, CRM-075): fecha, período, integrantes convocados, alumnos
// tratados y consideraciones. Se editan solo en borrador.

const personSelect = { select: { id: true, firstName: true, lastName: true } } as const
const studentSelect = {
  select: { id: true, firstName: true, lastName: true, dni: true },
} as const

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.lastName}, ${person.firstName}`

// Quién hace el cambio (del token) y desde qué IP, para la auditoría
interface Actor {
  userId: string
  ipAddress: string
}

// Personal que puede integrar el EDTE (Res. 1650/24, Anexo 2, inc. 22).
// Provisorio hasta que se fusione CRM-071: entonces los convocados salen del plantel activo
// (EdteTeamMember) y esta lista deja de usarse.
const EDTE_STAFF_ROLES: Role[] = [
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR,
  Role.ADMINISTRATOR,
]

const ENROLLED_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL]

const listNames = (people: { firstName: string; lastName: string }[]) =>
  people.map(fullName).join('; ')

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

// La fecha tiene que ser del año del ciclo; la reunión de febrero/marzo, de esos meses
function assertMeetingDate(date: string, period: EdteMeetingPeriod, year: number) {
  const day = toDate(date)
  if (day.getUTCFullYear() !== year) {
    throw new HttpError(409, `La fecha de la reunión tiene que ser del año ${year}`)
  }
  const month = day.getUTCMonth() // 0 = enero
  if (period === EdteMeetingPeriod.FEBRUARY_MARCH && month !== 1 && month !== 2) {
    throw new HttpError(409, 'La reunión de febrero/marzo tiene que ser en febrero o marzo')
  }
}

// Convocados: usuarios activos del personal. Devuelve el rol de cada uno, que se guarda como
// el rol con el que participó. Provisorio hasta CRM-071 (ver EDTE_STAFF_ROLES).
async function getEligibleMembers(db: Prisma.TransactionClient, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, Role>()
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, role: true, status: true },
  })
  if (users.length !== userIds.length) {
    throw new HttpError(404, 'Algún integrante no existe')
  }
  const invalid = users.filter(
    (user) => user.status !== UserStatus.ACTIVE || !EDTE_STAFF_ROLES.includes(user.role)
  )
  if (invalid.length > 0) {
    throw new HttpError(
      409,
      `No pueden integrar el EDTE (usuario inactivo o sin rol de personal): ${listNames(invalid)}`
    )
  }
  return new Map(users.map((user) => [user.id, user.role]))
}

// Alumnos tratados: tienen que existir y estar activos o condicionales
async function assertEligibleStudents(db: Prisma.TransactionClient, studentIds: string[]) {
  if (studentIds.length === 0) return
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, status: true },
  })
  if (students.length !== studentIds.length) {
    throw new HttpError(404, 'Algún alumno no existe')
  }
  const inactive = students.filter((student) => !ENROLLED_STATUSES.includes(student.status))
  if (inactive.length > 0) {
    throw new HttpError(409, `Estos alumnos no están activos: ${listNames(inactive)}`)
  }
}

// Resumen de la reunión para la auditoría (sin las consideraciones, que pueden ser sensibles)
const auditSnapshot = (data: {
  date: string
  period: EdteMeetingPeriod
  shift?: Shift | null
  members?: { userId: string; present: boolean }[]
  students?: { studentId: string }[]
}) => ({
  date: data.date,
  period: data.period,
  shift: data.shift ?? null,
  ...(data.members && {
    members: data.members.length,
    present: data.members.filter((member) => member.present).length,
  }),
  ...(data.students && { students: data.students.map((student) => student.studentId) }),
})

// Alta en borrador, con sus convocados y alumnos tratados
export async function createEdteMeeting(input: CreateEdteMeetingInput, actor: Actor) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { year: input.year },
    select: { id: true },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')
  assertMeetingDate(input.date, input.period, input.year)

  const id = await prisma.$transaction(async (tx) => {
    const roles = await getEligibleMembers(
      tx,
      input.members.map((member) => member.userId)
    )
    await assertEligibleStudents(
      tx,
      input.students.map((student) => student.studentId)
    )

    const meeting = await tx.edteMeeting.create({
      data: {
        academicYearId: academicYear.id,
        date: toDate(input.date),
        period: input.period,
        shift: input.shift ?? null,
        considerations: input.considerations || null,
        minutesUrl: input.minutesUrl || null,
        createdById: actor.userId,
        members: {
          create: input.members.map((member) => ({
            userId: member.userId,
            present: member.present,
            roleInMeeting: roles.get(member.userId) ?? null,
          })),
        },
        students: {
          create: input.students.map((student) => ({
            studentId: student.studentId,
            notes: student.notes || null,
          })),
        },
      },
      select: { id: true },
    })

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.CREATE,
        affectedEntity: 'EdteMeeting',
        entityId: meeting.id,
        newData: auditSnapshot(input),
        ipAddress: actor.ipAddress,
      },
    })
    return meeting.id
  })

  return getEdteMeeting(id)
}

// Edición: solo en borrador. Las listas que vienen reemplazan a las anteriores
export async function updateEdteMeeting(id: string, input: UpdateEdteMeetingInput, actor: Actor) {
  const meeting = await findMeetingOrFail(id)
  if (meeting.status !== EdteMeetingStatus.DRAFT) {
    throw new HttpError(409, 'La reunión ya está firmada: no se puede modificar')
  }

  const date = input.date ?? toDay(meeting.date)
  const period = input.period ?? meeting.period
  assertMeetingDate(date, period, meeting.academicYear.year)

  await prisma.$transaction(async (tx) => {
    const roles = input.members
      ? await getEligibleMembers(
          tx,
          input.members.map((member) => member.userId)
        )
      : null
    if (input.students) {
      await assertEligibleStudents(
        tx,
        input.students.map((student) => student.studentId)
      )
    }

    await tx.edteMeeting.update({
      where: { id },
      data: {
        ...(input.date !== undefined && { date: toDate(input.date) }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.shift !== undefined && { shift: input.shift }),
        ...(input.considerations !== undefined && {
          considerations: input.considerations || null,
        }),
        ...(input.minutesUrl !== undefined && { minutesUrl: input.minutesUrl || null }),
      },
    })

    if (input.members && roles) {
      await tx.edteMember.deleteMany({ where: { edteMeetingId: id } })
      await tx.edteMember.createMany({
        data: input.members.map((member) => ({
          edteMeetingId: id,
          userId: member.userId,
          present: member.present,
          roleInMeeting: roles.get(member.userId) ?? null,
        })),
      })
    }
    if (input.students) {
      await tx.edteMeetingStudent.deleteMany({ where: { edteMeetingId: id } })
      await tx.edteMeetingStudent.createMany({
        data: input.students.map((student) => ({
          edteMeetingId: id,
          studentId: student.studentId,
          notes: student.notes || null,
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.UPDATE,
        affectedEntity: 'EdteMeeting',
        entityId: id,
        previousData: auditSnapshot({
          date: toDay(meeting.date),
          period: meeting.period,
          shift: meeting.shift,
          members: meeting.members,
          students: meeting.students,
        }),
        newData: auditSnapshot({
          date,
          period,
          shift: input.shift !== undefined ? input.shift : meeting.shift,
          members: input.members,
          students: input.students,
        }),
        ipAddress: actor.ipAddress,
      },
    })
  })

  return getEdteMeeting(id)
}

// Alumnos derivados al EDTE al cierre del ciclo anterior: 5 o más MPAA pendientes (RN-012).
// Provisorio hasta que se fusione CRM-073: entonces se reemplaza por su listado de derivación
// (listEdteReferrals con year = el ciclo que cerró), que lee las decisiones del motor de
// promoción en lugar de contar las MPAA.
async function getReferredStudentIds(closedYear: number) {
  const groups = await prisma.pendingSubject.groupBy({
    by: ['studentId'],
    where: {
      status: PendingSubjectStatus.PENDING,
      originAcademicYear: { year: { lte: closedYear } },
      student: { status: { in: ENROLLED_STATUSES } },
    },
    _count: { _all: true },
    having: { studentId: { _count: { gte: 5 } } },
  })
  return groups.map((group) => group.studentId)
}

// Alumnos con PATE en curso en el ciclo, para las reuniones de seguimiento (agosto y diciembre).
// Cuando se fusione CRM-078, el PATE tiene su propio ciclo y el estado pasa a IN_PROGRESS.
async function getStudentsWithActivePate(academicYearId: string) {
  const pates = await prisma.pate.findMany({
    where: {
      // Con el enum actual, "en curso" son ACTIVE y UNDER_FOLLOW_UP
      status: { in: [PateStatus.ACTIVE, PateStatus.UNDER_FOLLOW_UP] },
      edteMeeting: { academicYearId },
      student: { status: { in: ENROLLED_STATUSES } },
    },
    select: { id: true, studentId: true, status: true },
  })
  return new Map(pates.map((pate) => [pate.studentId, { id: pate.id, status: pate.status }]))
}

// Alumnos para tratar en una reunión, según su período (DA7, 2.3):
// - febrero/marzo: los derivados al cierre del ciclo anterior, para armar su PATE;
// - agosto y diciembre: los que tienen PATE en curso, para el seguimiento;
// - adicional: los dos grupos.
// El selector del front ofrece estos alumnos; el alta acepta cualquier alumno activo.
export async function getEdteMeetingCandidates(query: EdteMeetingCandidatesQuery) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { year: query.year },
    select: { id: true },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')

  const wantsReferred =
    query.period === EdteMeetingPeriod.FEBRUARY_MARCH ||
    query.period === EdteMeetingPeriod.ADDITIONAL
  const wantsFollowUp = query.period !== EdteMeetingPeriod.FEBRUARY_MARCH

  const [referredIds, activePates] = await Promise.all([
    wantsReferred ? getReferredStudentIds(query.year - 1) : Promise.resolve([]),
    wantsFollowUp
      ? getStudentsWithActivePate(academicYear.id)
      : Promise.resolve(new Map<string, { id: string; status: PateStatus }>()),
  ])

  const referred = new Set(referredIds)
  const studentIds = [...new Set([...referredIds, ...activePates.keys()])]
  if (studentIds.length === 0) return []

  const [students, sections, pendingCounts] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, dni: true },
    }),
    currentSectionsByStudent(studentIds, academicYear.id),
    pendingCountByStudent(studentIds),
  ])

  return students
    .map((student) => ({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      dni: student.dni,
      section: sections.get(student.id) ?? null,
      pendingSubjectsCount: pendingCounts.get(student.id) ?? 0,
      // Por qué aparece: derivado al EDTE o seguimiento de su PATE
      referred: referred.has(student.id),
      pate: activePates.get(student.id) ?? null,
    }))
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es')
    )
}

// Marca la reunión como firmada: deja de poder editarse. Exige el acta cargada y que la reunión
// ya haya ocurrido. La firma digital de cada presente es otro requerimiento (E4-RF-04).
export async function signEdteMeeting(id: string, actor: Actor) {
  const meeting = await findMeetingOrFail(id)
  if (meeting.status !== EdteMeetingStatus.DRAFT) {
    throw new HttpError(409, 'La reunión ya está firmada')
  }
  if (!meeting.minutesUrl) {
    throw new HttpError(409, 'Para marcarla como firmada, cargá primero el enlace al acta')
  }
  if (toDay(meeting.date) > todayInSchoolTimeZone()) {
    throw new HttpError(409, 'La reunión todavía no ocurrió: no se puede marcar como firmada')
  }

  await prisma.$transaction(async (tx) => {
    const signedAt = new Date()
    // Solo si sigue en borrador (por si dos personas la firman a la vez)
    const { count } = await tx.edteMeeting.updateMany({
      where: { id, status: EdteMeetingStatus.DRAFT },
      data: { status: EdteMeetingStatus.SIGNED, signedAt, signedById: actor.userId },
    })
    if (count === 0) throw new HttpError(409, 'La reunión ya está firmada')

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.SIGN,
        affectedEntity: 'EdteMeeting',
        entityId: id,
        newData: { status: EdteMeetingStatus.SIGNED, signedAt: signedAt.toISOString() },
        ipAddress: actor.ipAddress,
      },
    })
  })

  return getEdteMeeting(id)
}

// Personal que se puede convocar a una reunión, para el checklist del formulario.
// Provisorio hasta CRM-071: entonces devuelve los integrantes activos del plantel del EDTE.
export async function getEdteMeetingMemberOptions() {
  const users = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVE, role: { in: EDTE_STAFF_ROLES } },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return users.map((user) => ({ userId: user.id, name: fullName(user), role: user.role }))
}
