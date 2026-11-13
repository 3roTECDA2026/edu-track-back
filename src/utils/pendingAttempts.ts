import type {
  IntensificationModel,
  IntensificationPeriod,
  IntensificationResultCode,
} from '@prisma/client'

// Historial de intentos de intensificación de una MPAA (E3-RF-03, CRM-054). Son funciones puras,
// sin base de datos, para poder probar el orden y la forma de la respuesta.

// Lo mínimo que se necesita de un intento. El ciclo sale del período del calendario (schedule),
// no de la fecha: la intensificación de febrero/marzo de 2026 cierra el ciclo 2025.
// schedule puede ser null en intentos viejos, que no tienen calendario.
export interface AttemptRecord {
  id: string
  period: IntensificationPeriod
  model: IntensificationModel
  resultCode: IntensificationResultCode | null
  score: number | null
  evaluationDate: Date | null
  createdAt: Date
  schedule: { startDate: Date; endDate: Date; academicYear: { year: number } } | null
}

// Fecha con la que se ordena: el inicio del período del calendario y, si el intento no tiene
// calendario, la fecha de evaluación o la de registro
const attemptDate = (attempt: AttemptRecord) =>
  attempt.schedule?.startDate ?? attempt.evaluationDate ?? attempt.createdAt

// Del más viejo al más nuevo. Si dos tienen la misma fecha, el que se registró antes va primero
export function sortAttemptsByDate(attempts: AttemptRecord[]) {
  return [...attempts].sort(
    (a, b) =>
      attemptDate(a).getTime() - attemptDate(b).getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime()
  )
}

export function toAttemptsResponse(attempts: AttemptRecord[]) {
  return sortAttemptsByDate(attempts).map((attempt) => ({
    id: attempt.id,
    period: attempt.period,
    cycleYear: attempt.schedule?.academicYear.year ?? null,
    startDate: attempt.schedule?.startDate ?? null,
    endDate: attempt.schedule?.endDate ?? null,
    model: attempt.model,
    resultCode: attempt.resultCode,
    score: attempt.score,
  }))
}
