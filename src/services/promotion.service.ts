import {
  PendingSubjectStatus,
  PromotionOutcome,
  StudentStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

export async function runPromotion(academicYearId: string, executedById: string) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { id: true, year: true },
  })

  if (!academicYear) {
    throw new HttpError(404, 'Ciclo lectivo no encontrado')
  }

  return prisma.$transaction(async (tx) => {
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

    await tx.promotionDecision.deleteMany({
      where: { academicYearId },
    })

    const decisions = []

    for (const student of students) {
      const pendingCount = student.pendingSubjects.length
      const outcome =
        pendingCount >= 5
          ? PromotionOutcome.REFERRED_TO_EDTE
          : PromotionOutcome.PROMOTED

      const decision = await tx.promotionDecision.create({
        data: {
          studentId: student.id,
          academicYearId,
          pendingCount,
          outcome,
          executedById,
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
      })

      decisions.push(decision)
    }

    return decisions
  })
}
