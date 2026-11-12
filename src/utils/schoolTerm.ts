import { Term } from '@prisma/client'

type TermDates = { term2StartDate: Date | null }

// Cuatrimestre en curso: el 2° desde que empieza (según las fechas del ciclo); antes, el 1°.
// A diferencia de la asignación de fechas del RITE, nunca queda vacío: en el receso de invierno
// sigue siendo el 1°. Sin fechas cargadas, agosto a diciembre es el 2°.
export function currentTerm(dates: TermDates, today: Date = new Date()): Term {
  if (dates.term2StartDate) return today >= dates.term2StartDate ? Term.SECOND : Term.FIRST
  return today.getUTCMonth() >= 7 ? Term.SECOND : Term.FIRST
}
