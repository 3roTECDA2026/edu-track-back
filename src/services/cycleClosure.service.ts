import {
  AuditActionType,
  IntensificationPeriod,
  PendingSubjectStatus,
  Prisma,
  SubjectStatus,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { toDay, todayInSchoolTimeZone } from '@/utils/schoolDate'
import { evaluateSubjectApproval } from '@/utils/subjectApproval'

// Cierre del ciclo lectivo (CRM-052, E3-RF-01): las materias no aprobadas pasan a MPAA.

// Períodos de intensificación del ciclo. El de agosto ya es del ciclo siguiente (decisión 3)
const CYCLE_PERIODS = [IntensificationPeriod.DECEMBER, IntensificationPeriod.FEBRUARY_MARCH]

interface Actor {
  userId: string
  ipAddress: string
}

const enrollmentSelect = {
  id: true,
  studentId: true,
  subjectId: true,
  subjectStatus: true,
  student: { select: { firstName: true, lastName: true } },
  subject: { select: { name: true } },
  classSection: { select: { grade: true, division: true } },
  pendingSubject: { select: { id: true } },
  grade: {
    select: {
      term1Score: true,
      term2Score: true,
      term1IntensificationScore: true,
      rationale2: true,
      subjectStatus: true,
    },
  },
} satisfies Prisma.EnrollmentSelect

type EnrollmentForClosure = Prisma.EnrollmentGetPayload<{
  select: typeof enrollmentSelect & {
    intensifications: {
      select: { period: true; resultCode: true; score: true; pendingKnowledge: true }
    }
  }
}>

export interface UnratedSubject {
  studentId: string
  studentName: string
  subjectName: string
  classSection: string
}

export interface CycleClosureSummary {
  academicYear: number
  dryRun: boolean
  alreadyClosed: boolean
  closedAt: string | null
  studentsWithNewMpaa: number
  newMpaa: number
  alreadyMpaa: number
  approved: number
  unrated: UnratedSubject[]
}

// AAAA-MM-DD → DD/MM/AAAA, para los mensajes
const formatDay = (day: string) => day.split('-').reverse().join('/')

const blankToNull = (value: string | null | undefined) => value?.trim() || null

// Saberes pendientes al inicio del ciclo siguiente (decisión 5): los del último intento
// (febrero/marzo, si no diciembre); si no hay, la fundamentación del 2.º cuatrimestre
function initialPendingKnowledge(enrollment: EnrollmentForClosure) {
  const byPeriod = (period: IntensificationPeriod) =>
    blankToNull(enrollment.intensifications.find((a) => a.period === period)?.pendingKnowledge)
  return (
    byPeriod(IntensificationPeriod.FEBRUARY_MARCH) ??
    byPeriod(IntensificationPeriod.DECEMBER) ??
    blankToNull(enrollment.grade?.rationale2)
  )
}

// Valida que el ciclo se pueda cerrar: existe, terminó su período de febrero/marzo y no quedan
// intentos de diciembre o febrero/marzo sin resultado
async function findClosableCycle(academicYearId: string) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: {
      id: true,
      year: true,
      closedAt: true,
      intensificationSchedules: {
        where: { period: IntensificationPeriod.FEBRUARY_MARCH },
        select: { endDate: true },
      },
    },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')

  const februaryMarch = academicYear.intensificationSchedules[0]
  if (!februaryMarch) {
    // Sin ese período no hay forma de saber si ya terminó
    throw new HttpError(
      409,
      'Este ciclo no tiene cargado el período de febrero/marzo en el calendario de intensificación'
    )
  }
  const endDay = toDay(februaryMarch.endDate)
  if (todayInSchoolTimeZone() <= endDay) {
    throw new HttpError(
      409,
      `El período de febrero/marzo de este ciclo termina el ${formatDay(endDay)}: no se puede cerrar antes`
    )
  }

  const attemptsWithoutResult = await prisma.intensification.count({
    where: {
      resultCode: null,
      schedule: { academicYearId, period: { in: CYCLE_PERIODS } },
    },
  })
  if (attemptsWithoutResult > 0) {
    const attempts =
      attemptsWithoutResult === 1
        ? 'Todavía hay 1 intento'
        : `Todavía hay ${attemptsWithoutResult} intentos`
    throw new HttpError(
      409,
      `${attempts} de intensificación sin resultado en este ciclo: cargalos antes de cerrar`
    )
  }

  return academicYear
}

// Ejecuta el cierre (o lo simula con dryRun, sin escribir nada) y devuelve el resumen.
// Se puede volver a ejecutar (decisión 7): las materias con MPAA y las ya aprobadas no se tocan,
// así que una nueva ejecución solo procesa las que estaban sin calificar y ya tienen notas.
export async function closeCycle(
  academicYearId: string,
  actor: Actor,
  { dryRun }: { dryRun: boolean }
): Promise<CycleClosureSummary> {
  const academicYear = await findClosableCycle(academicYearId)
  const alreadyClosed = academicYear.closedAt !== null

  // Todas las cursadas y recursadas del ciclo, con sus intentos de diciembre y febrero/marzo
  const enrollments: EnrollmentForClosure[] = await prisma.enrollment.findMany({
    where: { academicYearId },
    select: {
      ...enrollmentSelect,
      intensifications: {
        where: { schedule: { academicYearId, period: { in: CYCLE_PERIODS } } },
        select: { period: true, resultCode: true, score: true, pendingKnowledge: true },
      },
    },
  })

  let alreadyMpaa = 0
  const alreadyApproved: EnrollmentForClosure[] = []
  const approved: Array<{ enrollment: EnrollmentForClosure; finalScore: number | null }> = []
  const notApproved: EnrollmentForClosure[] = []
  const unrated: EnrollmentForClosure[] = []

  for (const enrollment of enrollments) {
    if (enrollment.pendingSubject) {
      alreadyMpaa += 1
      continue
    }
    // Ya aprobada (por ejemplo, con AA en una intensificación): no se recalcula la nota
    if (enrollment.grade?.subjectStatus === SubjectStatus.APPROVED_ACCREDITED) {
      alreadyApproved.push(enrollment)
      continue
    }
    const result = evaluateSubjectApproval({
      term1Score: enrollment.grade?.term1Score ?? null,
      term2Score: enrollment.grade?.term2Score ?? null,
      term1IntensificationScore: enrollment.grade?.term1IntensificationScore ?? null,
      attempts: enrollment.intensifications,
    })
    if (result.outcome === 'APPROVED') approved.push({ enrollment, finalScore: result.finalScore })
    else if (result.outcome === 'NOT_APPROVED') notApproved.push(enrollment)
    else unrated.push(enrollment)
  }

  const summary = {
    academicYear: academicYear.year,
    dryRun,
    alreadyClosed,
    studentsWithNewMpaa: new Set(notApproved.map((e) => e.studentId)).size,
    newMpaa: notApproved.length,
    alreadyMpaa,
    approved: alreadyApproved.length + approved.length,
    unrated: unrated.map(toUnratedSubject).sort(byClassSectionAndName),
  }

  if (dryRun) {
    return { ...summary, closedAt: academicYear.closedAt?.toISOString() ?? null }
  }

  const notApprovedIds = notApproved.map((e) => e.id)

  // Aprobadas agrupadas por nota final: una consulta por nota, no una por alumno
  const approvedByScore = new Map<number | null, string[]>()
  for (const { enrollment, finalScore } of approved) {
    approvedByScore.set(finalScore, [...(approvedByScore.get(finalScore) ?? []), enrollment.id])
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // El @unique de originEnrollmentId evita duplicar aunque haya dos ejecuciones a la vez
    const created = await tx.pendingSubject.createMany({
      data: notApproved.map((enrollment) => ({
        studentId: enrollment.studentId,
        subjectId: enrollment.subjectId,
        originEnrollmentId: enrollment.id,
        originAcademicYearId: academicYearId,
        status: PendingSubjectStatus.PENDING,
        initialPendingKnowledge: initialPendingKnowledge(enrollment),
      })),
      skipDuplicates: true,
    })

    // No aprobadas: pasan a MPAA y la nota final queda vacía (decisión 9)
    await tx.enrollment.updateMany({
      where: { id: { in: notApprovedIds } },
      data: { subjectStatus: SubjectStatus.MPAA },
    })
    await tx.grade.updateMany({
      where: { enrollmentId: { in: notApprovedIds } },
      data: { subjectStatus: SubjectStatus.MPAA, finalScore: null },
    })

    // Aprobadas: nota final y estado, en Grade y en Enrollment
    for (const [finalScore, ids] of approvedByScore) {
      await tx.grade.updateMany({
        where: { enrollmentId: { in: ids } },
        data: { subjectStatus: SubjectStatus.APPROVED_ACCREDITED, finalScore },
      })
    }
    // Las ya aprobadas solo alinean el estado de la inscripción: las AA cargadas antes del
    // ajuste de CRM-058 lo tienen desfasado
    await tx.enrollment.updateMany({
      where: {
        id: { in: [...approved.map((a) => a.enrollment.id), ...alreadyApproved.map((e) => e.id)] },
        subjectStatus: { not: SubjectStatus.APPROVED_ACCREDITED },
      },
      data: { subjectStatus: SubjectStatus.APPROVED_ACCREDITED },
    })

    // Solo la primera ejecución marca el cierre
    if (!alreadyClosed) {
      await tx.academicYear.updateMany({
        where: { id: academicYearId, closedAt: null },
        data: { closedAt: new Date(), closedById: actor.userId },
      })
    }
    const { closedAt } = await tx.academicYear.findUniqueOrThrow({
      where: { id: academicYearId },
      select: { closedAt: true },
    })

    const result: CycleClosureSummary = {
      ...summary,
      newMpaa: created.count,
      closedAt: closedAt?.toISOString() ?? null,
    }
    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.CLOSE,
        affectedEntity: 'AcademicYear',
        entityId: academicYearId,
        newData: result as unknown as Prisma.InputJsonValue,
        ipAddress: actor.ipAddress,
      },
    })
    return result
  })
}

function toUnratedSubject(enrollment: EnrollmentForClosure): UnratedSubject {
  const { student, subject, classSection } = enrollment
  return {
    studentId: enrollment.studentId,
    studentName: `${student.lastName}, ${student.firstName}`,
    subjectName: subject.name,
    classSection: `${classSection.grade}.º ${classSection.division}`,
  }
}

function byClassSectionAndName(a: UnratedSubject, b: UnratedSubject) {
  return (
    a.classSection.localeCompare(b.classSection, 'es') ||
    a.studentName.localeCompare(b.studentName, 'es') ||
    a.subjectName.localeCompare(b.subjectName, 'es')
  )
}
