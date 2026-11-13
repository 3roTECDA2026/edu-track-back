import { PromotionOutcome } from '@prisma/client'

// Decisión del motor de promoción (E3-RF-11/12): se deriva al EDTE desde 5 MPAA pendientes.
// El conteo es acumulado: todas las MPAA PENDING del alumno, no solo las del ciclo.
export function decideOutcome(pendingCount: number): PromotionOutcome {
  return pendingCount >= 5 ? PromotionOutcome.REFERRED_TO_EDTE : PromotionOutcome.PROMOTED
}
