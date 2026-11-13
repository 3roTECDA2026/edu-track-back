import crypto from 'node:crypto'
import { PendingSubjectStatus, Prisma, StudentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { decideOutcome } from '@/utils/promotion'

export async function runPromotion(academicYearId: string, executedById: string) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { id: true, year: true, closedAt: true },
  })

  if (!academicYear) {
    throw new HttpError(404, 'Ciclo lectivo no encontrado')
  }

  if (!academicYear.closedAt) {
    throw new HttpError(
      409,
      'El ciclo lectivo debe estar cerrado para ejecutar el motor de promoción'
    )
  }

  const transaction = prisma.$transaction(async (tx) => {
    // No se permite re-ejecutar: evita duplicar decisiones (CRM-073 las leería repetidas).
    const existing = await tx.promotionDecision.count({ where: { academicYearId } })
    if (existing > 0) {
      throw new HttpError(409, 'El motor de promoción ya se ejecutó para este ciclo')
    }
    const students = await tx.student.findMany({
      where: {
        status: { in: [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL] },
        OR: [
          {
            enrollmentHistory: {
              some: {
                classSection: { academicYearId },
                endDate: null,
              },
            },
          },
          {
            enrollments: {
              some: { academicYearId },
            },
          },
          {
            pendingSubjects: {
              some: { originAcademicYearId: academicYearId },
            },
          },
        ],
      },
      include: {
        pendingSubjects: {
          where: { status: PendingSubjectStatus.PENDING },
          select: { id: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    // Conservamos el historial de auditoría: no se eliminan las decisiones previas

    const executedAt = new Date()
    const decisionsData = students.map((student) => {
      const pendingCount = student.pendingSubjects.length
      // Conteo acumulado: cuenta todas las MPAA PENDING del alumno, no solo las del ciclo.
      const outcome = decideOutcome(pendingCount)

      return {
        id: crypto.randomUUID(),
        studentId: student.id,
        academicYearId,
        pendingCount,
        outcome,
        executedById,
        executedAt,
      }
    })

    if (decisionsData.length > 0) {
      await tx.promotionDecision.createMany({
        data: decisionsData,
      })
    }

    const decisionIds = decisionsData.map((d) => d.id)

    return tx.promotionDecision.findMany({
      where: {
        id: { in: decisionIds },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    })
  })

  try {
    return await transaction
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'El motor de promoción ya se ejecutó para este ciclo')
    }
    throw error
  }
}
