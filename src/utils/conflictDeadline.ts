// E4-RF-18: plazo máximo de 24 horas entre que ocurre el suceso y se registra el conflicto.
export const CONFLICT_DEADLINE_HOURS = 24

const MS_PER_HOUR = 60 * 60 * 1000

export interface ConflictDeadline {
  // true si se registró en menos de 24 hs; null si el conflicto no tiene fecha del suceso
  withinDeadline: boolean | null
  // Horas enteras entre el suceso y el registro; null si no hay fecha del suceso
  elapsedHours: number | null
}

export function calculateConflictDeadline(
  occurrenceDate: Date | null,
  registeredAt: Date
): ConflictDeadline {
  if (!occurrenceDate) return { withinDeadline: null, elapsedHours: null }

  const elapsedMs = registeredAt.getTime() - occurrenceDate.getTime()

  return {
    withinDeadline: elapsedMs < CONFLICT_DEADLINE_HOURS * MS_PER_HOUR,
    elapsedHours: Math.max(0, Math.floor(elapsedMs / MS_PER_HOUR)),
  }
}
