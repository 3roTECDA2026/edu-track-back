import { PrismaClient, PromotionOutcome } from '@prisma/client'

const prisma = new PrismaClient()

export async function runPromotion(academicYearId: string, executedById: string) {
  const pending = await prisma.pendingSubject.groupBy({
    by: ['studentId'],
    where: { status: 'PENDING', originAcademicYearId: academicYearId },
    _count: { _all: true },
  })

  const results = []
  for (const row of pending) {
    const count = row._count._all
    const outcome =
      count >= 5 ? PromotionOutcome.REFERRED_TO_EDTE : PromotionOutcome.PROMOTED
    const decision = await prisma.promotionDecision.create({
      data: {
        studentId: row.studentId,
        academicYearId,
        pendingCount: count,
        outcome,
        executedById,
      },
    })
    results.push(decision)
  }
  return results
}
