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
import { closingFinalScore, initialPendingKnowledge } from '@/utils/cycleClosureRules'
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
  // MPAA que se recursa con esta inscripción (CRM-082); null en las cursadas por primera vez
  repeatedPendingSubjectId: true,
  grade: {
    select: {
      finalScore: true,
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
  // Recursados (CRM-082): aprobados acreditan su MPAA; los no aprobados no crean una nueva
  repeatsAccredited: number
  repeatsNotApproved: number
  unrated: UnratedSubject[]
}

// AAAA-MM-DD → DD/MM/AAAA, para los mensajes
const formatDay = (day: string) => day.split('-').reverse().join('/')

// Agrupa las cursadas por nota final: una consulta por nota, no una por alumno
function groupByFinalScore(items: Array<{ id: string; finalScore: number | null }>) {
  const groups = new Map<number | null, string[]>()
  for (const { id, finalScore } of items) {
    groups.set(finalScore, [...(groups.get(finalScore) ?? []), id])
  }
  return groups
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
  // Recursados (CRM-082, decisión del equipo): si aprueba, la MPAA queda acreditada con la nota
  // del recursado; si no, sigue pendiente la MPAA original y no se crea otra
  const repeatsToAccredit: Array<{ pendingSubjectId: string; finalScore: number | null }> = []
  const repeatsNotApproved: EnrollmentForClosure[] = []

  for (const enrollment of enrollments) {
    if (enrollment.pendingSubject) {
      alreadyMpaa += 1
      continue
    }
    // Ya aprobada (por ejemplo, con AA en una intensificación): no se recalcula la nota
    if (enrollment.grade?.subjectStatus === SubjectStatus.APPROVED_ACCREDITED) {
      alreadyApproved.push(enrollment)
      // Si es un recursado, se vuelve a pedir la acreditación de su MPAA: si ya estaba
      // acreditada no cambia nada, y si una ejecución anterior no llegó a hacerlo, la completa
      if (enrollment.repeatedPendingSubjectId) {
        repeatsToAccredit.push({
          pendingSubjectId: enrollment.repeatedPendingSubjectId,
          finalScore: enrollment.grade.finalScore,
        })
      }
      continue
    }
    const result = evaluateSubjectApproval({
      term1Score: enrollment.grade?.term1Score ?? null,
      term2Score: enrollment.grade?.term2Score ?? null,
      term1IntensificationScore: enrollment.grade?.term1IntensificationScore ?? null,
      attempts: enrollment.intensifications,
    })
    if (result.outcome === 'APPROVED') {
      approved.push({ enrollment, finalScore: result.finalScore })
      if (enrollment.repeatedPendingSubjectId) {
        repeatsToAccredit.push({
          pendingSubjectId: enrollment.repeatedPendingSubjectId,
          finalScore: result.finalScore,
        })
      }
    } else if (result.outcome === 'NOT_APPROVED') {
      if (enrollment.repeatedPendingSubjectId) repeatsNotApproved.push(enrollment)
      else notApproved.push(enrollment)
    } else unrated.push(enrollment)
  }

  const summary = {
    academicYear: academicYear.year,
    dryRun,
    alreadyClosed,
    studentsWithNewMpaa: new Set(notApproved.map((e) => e.studentId)).size,
    newMpaa: notApproved.length,
    alreadyMpaa,
    approved: alreadyApproved.length + approved.length,
    repeatsAccredited: repeatsToAccredit.length,
    repeatsNotApproved: repeatsNotApproved.length,
    unrated: unrated.map(toUnratedSubject).sort(byClassSectionAndName),
  }

  if (dryRun) {
    return { ...summary, closedAt: academicYear.closedAt?.toISOString() ?? null }
  }

  const notApprovedIds = notApproved.map((e) => e.id)
  const approvedByScore = groupByFinalScore(
    approved.map(({ enrollment, finalScore }) => ({ id: enrollment.id, finalScore }))
  )
  const mpaaByScore = groupByFinalScore(
    notApproved.map((enrollment) => ({
      id: enrollment.id,
      finalScore: closingFinalScore(enrollment),
    }))
  )

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
        finalScore: closingFinalScore(enrollment),
      })),
      skipDuplicates: true,
    })

    // No aprobadas: pasan a MPAA, con la nota del último intento como nota final (decisión 9)
    await tx.enrollment.updateMany({
      where: { id: { in: notApprovedIds } },
      data: { subjectStatus: SubjectStatus.MPAA },
    })
    for (const [finalScore, ids] of mpaaByScore) {
      await tx.grade.updateMany({
        where: { enrollmentId: { in: ids } },
        data: { subjectStatus: SubjectStatus.MPAA, finalScore },
      })
    }

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

    // Recursados aprobados: acreditan la MPAA que recursaban, con la nota del recursado.
    // Solo si sigue pendiente, para no pisar una acreditación anterior
    const accreditedAt = new Date()
    for (const { pendingSubjectId, finalScore } of repeatsToAccredit) {
      await tx.pendingSubject.updateMany({
        where: { id: pendingSubjectId, status: PendingSubjectStatus.PENDING },
        data: { status: PendingSubjectStatus.ACCREDITED, finalScore, accreditedAt },
      })
    }
    // Recursados no aprobados: la materia sigue como MPAA (la original), sin crear otra
    const repeatsNotApprovedIds = repeatsNotApproved.map((e) => e.id)
    await tx.enrollment.updateMany({
      where: { id: { in: repeatsNotApprovedIds } },
      data: { subjectStatus: SubjectStatus.MPAA },
    })
    await tx.grade.updateMany({
      where: { enrollmentId: { in: repeatsNotApprovedIds } },
      data: { subjectStatus: SubjectStatus.MPAA },
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
