import { IntensificationResultCode } from '@prisma/client'

// Regla de aprobación de una materia del ciclo (E2-RF-05, Res. 1650/24, Anexo 5, incs. 4 y 8).
// La usa el cierre del ciclo (CRM-052) para decidir qué materias pasan a MPAA.

// Nota mínima para aprobar un cuatrimestre (Anexo 5, inc. 3)
export const PASSING_TERM_SCORE = 7

export interface SubjectApprovalInput {
  term1Score: number | null
  term2Score: number | null
  // Nota con la que recuperó el 1.º cuatrimestre durante el 2.º (Anexo 5, inc. 25.a)
  term1IntensificationScore: number | null
  // Intentos de intensificación del ciclo (diciembre y febrero/marzo)
  attempts: Array<{ resultCode: IntensificationResultCode | null; score: number | null }>
}

export type SubjectApproval =
  | { outcome: 'APPROVED'; finalScore: number | null }
  | { outcome: 'NOT_APPROVED' }
  // Sin las notas necesarias no se sabe si desaprobó: no pasa a MPAA (decisión 4 del plan)
  | { outcome: 'UNRATED' }

const passes = (score: number | null): score is number =>
  score !== null && score >= PASSING_TERM_SCORE

// Promedio sin redondear: 7 y 8 → 7,5 (Anexo 5, inc. 8.a; decisión 8 del plan)
const average = (first: number, second: number) => (first + second) / 2

export function evaluateSubjectApproval(input: SubjectApprovalInput): SubjectApproval {
  // Aprobó en una intensificación: la nota final es la de ese período (Anexo 5, incs. 8.b y 8.c)
  const accredited = input.attempts.find(
    (attempt) => attempt.resultCode === IntensificationResultCode.AA
  )
  if (accredited) return { outcome: 'APPROVED', finalScore: accredited.score }

  const { term1Score, term2Score, term1IntensificationScore } = input
  if (term2Score === null || (term1Score === null && term1IntensificationScore === null)) {
    // Si ya intensificó y no aprobó, sí se sabe que desaprobó, aunque falten notas
    const intensified = input.attempts.some((attempt) => attempt.resultCode !== null)
    return intensified ? { outcome: 'NOT_APPROVED' } : { outcome: 'UNRATED' }
  }

  if (passes(term2Score)) {
    if (passes(term1Score)) {
      return { outcome: 'APPROVED', finalScore: average(term1Score, term2Score) }
    }
    // Recuperó el 1.º durante el 2.º: esa nota reemplaza a la del 1.º en el promedio.
    // Pendiente de confirmar con el equipo (punto 3.2.1 del plan).
    if (passes(term1IntensificationScore)) {
      return { outcome: 'APPROVED', finalScore: average(term1IntensificationScore, term2Score) }
    }
  }

  return { outcome: 'NOT_APPROVED' }
}
