import { IntensificationPeriod } from '@prisma/client'

// Reglas del cierre del ciclo lectivo que se pueden probar sin base de datos (E3-RF-01, CRM-052).
// Las usa cycleClosure.service.ts al dar de alta las MPAA.

// Lo mínimo que necesitan de una cursada: sus intentos del ciclo y su fundamentación del 2.º C
export interface ClosureEnrollment {
  intensifications: Array<{
    period: IntensificationPeriod
    score: number | null
    pendingKnowledge: string | null
  }>
  grade: { rationale2: string | null } | null
}

const blankToNull = (value: string | null | undefined) => value?.trim() || null

// Saberes pendientes al inicio del ciclo siguiente (decisión 5): los del último intento
// (febrero/marzo, si no diciembre); si no hay, la fundamentación del 2.º cuatrimestre
export function initialPendingKnowledge(enrollment: ClosureEnrollment) {
  const byPeriod = (period: IntensificationPeriod) =>
    blankToNull(enrollment.intensifications.find((a) => a.period === period)?.pendingKnowledge)
  return (
    byPeriod(IntensificationPeriod.FEBRUARY_MARCH) ??
    byPeriod(IntensificationPeriod.DECEMBER) ??
    blankToNull(enrollment.grade?.rationale2)
  )
}

// Nota final de una MPAA al cierre del ciclo (Anexo 5, inc. 8.d; RITE, nota 4): la del último
// período de intensificación en que participó (febrero/marzo, si no diciembre). Como se aprueba
// con 4, es una nota de 1 a 3. Si el docente no la cargó, queda vacía
export function closingFinalScore(enrollment: ClosureEnrollment) {
  const lastAttempt =
    enrollment.intensifications.find((a) => a.period === IntensificationPeriod.FEBRUARY_MARCH) ??
    enrollment.intensifications.find((a) => a.period === IntensificationPeriod.DECEMBER)
  return lastAttempt?.score ?? null
}
