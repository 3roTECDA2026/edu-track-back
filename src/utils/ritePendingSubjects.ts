import { IntensificationPeriod, IntensificationResultCode, Term } from '@prisma/client'

// Tabla de materias pendientes (MPAA) del RITE (E2-RF-14, CRM-044). Son funciones puras, sin base
// de datos, para poder probar cada caso borde: el ciclo de cada intento, los períodos que informa
// cada RITE, la nota y los saberes al cierre, y el resultado de cada período.

// La tabla de MPAA de la plantilla tiene 4 filas: es el máximo de MPAA (Res. 1650/24, Anexo 5, incs. 12 y 13).
export const MAX_PENDING_SUBJECT_ROWS = 4

// Los seis períodos del ciclo, en orden (Res. 1650/24, Anexo 2).
export const PERIOD_ORDER: IntensificationPeriod[] = [
  IntensificationPeriod.MARCH,
  IntensificationPeriod.JULY,
  IntensificationPeriod.AUGUST,
  IntensificationPeriod.DECEMBER_TERM_CLOSE,
  IntensificationPeriod.DECEMBER,
  IntensificationPeriod.FEBRUARY_MARCH,
]

// Períodos que informa cada RITE (Anexo 2): el del 1.º cuatrimestre llega hasta julio, el del 2.º
// hasta diciembre 1 y el posterior a la intensificación muestra los seis.
export function periodsShownBy(term: Term, isPostIntensification: boolean) {
  if (isPostIntensification) return PERIOD_ORDER
  return PERIOD_ORDER.slice(0, term === Term.FIRST ? 2 : 4)
}

// Lo mínimo que se necesita de un intento de intensificación. El ciclo sale del período del
// calendario al que pertenece el intento (schedule.academicYear) y no de su fecha: la
// intensificación de febrero/marzo de 2026 cierra el ciclo 2025.
export interface PendingAttempt {
  period: IntensificationPeriod
  resultCode: IntensificationResultCode | null
  score: number | null
  pendingKnowledge: string | null
  schedule: { academicYear: { year: number } } | null
}

export interface PendingSubjectInput {
  subject: { name: string; gradeLevel: number }
  originAcademicYear: { year: number }
  originEnrollment: { originalGradeLevel: number | null; intensifications: PendingAttempt[] }
  initialPendingKnowledge: string | null
  finalScore: number | null // Nota de origen: con la que nació la MPAA (la guarda el cierre, CRM-052)
}

const byPeriod = (a: PendingAttempt, b: PendingAttempt) =>
  PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)

const yearOf = (attempt: PendingAttempt) => attempt.schedule?.academicYear.year

// Nota y saberes al cierre de una MPAA que sigue pendiente (Anexo 5, inc. 8.d): los del último
// intento del ciclo. Se calculan desde los intentos y no se guardan en PendingSubject, porque una
// MPAA puede durar más de un ciclo y cada RITE tiene que mostrar los de su ciclo (decisión 2.2.1,
// opción B, confirmada por el equipo).
// Sin intentos en el ciclo: la nota con la que nació la MPAA y los saberes vacíos.
export function closingValues(currentAttempts: PendingAttempt[], originScore: number | null) {
  const last = currentAttempts.at(-1)
  if (!last) return { finalScore: originScore, closingPendingKnowledge: null }
  return {
    finalScore: last.score ?? null,
    closingPendingKnowledge: last.pendingKnowledge ?? null,
  }
}

// Una fila de la tabla de MPAA de la página 2.
export function toPendingSubjectRow(
  pending: PendingSubjectInput,
  year: number,
  shown: IntensificationPeriod[],
  isClosing: boolean
) {
  const attempts = pending.originEnrollment.intensifications
  const current = attempts
    .filter((attempt) => yearOf(attempt) === year && shown.includes(attempt.period))
    .sort(byPeriod)

  // Saberes iniciales: los que se guardaron al alta de la MPAA (CRM-052) si se originó en el ciclo
  // anterior; si viene de antes, los que quedaron pendientes en el último intento del ciclo anterior.
  const previousLast = attempts
    .filter((attempt) => yearOf(attempt) === year - 1)
    .sort(byPeriod)
    .at(-1)
  const initialPendingKnowledge =
    pending.originAcademicYear.year === year - 1
      ? (pending.initialPendingKnowledge ?? previousLast?.pendingKnowledge ?? null)
      : (previousLast?.pendingKnowledge ?? pending.initialPendingKnowledge ?? null)

  // Resultado de cada período; después del AA los períodos quedan vacíos.
  const accredited = current.find((attempt) => attempt.resultCode === IntensificationResultCode.AA)
  const lastIndex = accredited ? PERIOD_ORDER.indexOf(accredited.period) : PERIOD_ORDER.length
  const results = Object.fromEntries(
    PERIOD_ORDER.map((period, index) => {
      const attempt = current.find((item) => item.period === period)
      return [period, attempt && index <= lastIndex ? attempt.resultCode : null]
    })
  ) as Record<IntensificationPeriod, IntensificationResultCode | null>

  // Con AA en este ciclo, la nota final es la de ese intento (4 a 10). Si sigue pendiente, la nota
  // (1 a 3) y los saberes al cierre van solo cuando el ciclo ya cerró; antes quedan vacíos.
  const closing = accredited
    ? { finalScore: accredited.score, closingPendingKnowledge: null }
    : isClosing
      ? closingValues(current, pending.finalScore)
      : { finalScore: null, closingPendingKnowledge: null }

  return {
    subjectName: pending.subject.name,
    gradeLevel: pending.originEnrollment.originalGradeLevel ?? pending.subject.gradeLevel,
    originYear: pending.originAcademicYear.year,
    initialPendingKnowledge,
    results,
    ...closing,
  }
}

// Diciembre y febrero de la página 1: con AA va la nota; con CCA o CSA, el código
// (Res. 1650/24, Anexo 5). Solo cuentan los intentos del ciclo del RITE (los que trae la consulta).
export function intensificationResultOf(
  attempts: {
    period: IntensificationPeriod
    score: number | null
    resultCode: IntensificationResultCode | null
  }[],
  period: IntensificationPeriod
) {
  const attempt = attempts.find((item) => item.period === period)
  return { score: attempt?.score ?? null, resultCode: attempt?.resultCode ?? null }
}
