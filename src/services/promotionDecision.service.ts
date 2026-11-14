import { PromotionOutcome, StudentStatus, type Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// Decisiones del motor de promoción (CRM-062) que usan otros módulos.

const ENROLLED_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL]

// Alumnos derivados al EDTE al cierre de `closedYear` (RN-012, CRM-073): los que el motor de
// promoción decidió REFERRED_TO_EDTE. No recalcula las MPAA: si el motor no se ejecutó para ese
// ciclo, no hay derivados. Solo alumnos activos o condicionales. Con `studentIds`, se limita a esos.
// La usan las reuniones del EDTE (CRM-075) y el PATE (CRM-078).
export async function getReferredStudentIds(
  closedYear: number,
  studentIds?: string[],
  db: Pick<Prisma.TransactionClient, 'promotionDecision'> = prisma
) {
  const decisions = await db.promotionDecision.findMany({
    where: {
      outcome: PromotionOutcome.REFERRED_TO_EDTE,
      academicYear: { year: closedYear },
      student: { status: { in: ENROLLED_STATUSES } },
      ...(studentIds && { studentId: { in: studentIds } }),
    },
    select: { studentId: true },
  })
  return decisions.map((decision) => decision.studentId)
}
