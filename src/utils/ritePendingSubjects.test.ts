import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IntensificationPeriod, IntensificationResultCode, Term } from '@prisma/client'

import {
  PERIOD_ORDER,
  closingValues,
  intensificationResultOf,
  periodsShownBy,
  toPendingSubjectRow,
  type PendingAttempt,
  type PendingSubjectInput,
} from './ritePendingSubjects'

const { MARCH, JULY, AUGUST, DECEMBER_TERM_CLOSE, DECEMBER, FEBRUARY_MARCH } = IntensificationPeriod
const { AA, CCA, CSA } = IntensificationResultCode

// Intento de intensificación del ciclo indicado. El ciclo sale del calendario (schedule), no de
// una fecha: la intensificación de febrero/marzo de 2026 es del ciclo 2025.
const attempt = (
  period: IntensificationPeriod,
  cycleYear: number,
  resultCode: IntensificationResultCode | null,
  score: number | null = null,
  pendingKnowledge: string | null = null
): PendingAttempt => ({
  period,
  resultCode,
  score,
  pendingKnowledge,
  schedule: { academicYear: { year: cycleYear } },
})

// MPAA que quedó pendiente en 2025, con la nota 2 con la que nació
const pendingSubject = (
  attempts: PendingAttempt[],
  overrides: Partial<PendingSubjectInput> = {}
): PendingSubjectInput => ({
  subject: { name: 'Biología', gradeLevel: 4 },
  originAcademicYear: { year: 2025 },
  originEnrollment: { originalGradeLevel: null, intensifications: attempts },
  initialPendingKnowledge: 'Célula',
  finalScore: 2,
  ...overrides,
})

const shownBy = (term: Term, post = false) => periodsShownBy(term, post)
const nonEmpty = (results: Record<string, unknown>) =>
  Object.entries(results).filter(([, value]) => value !== null)

describe('períodos que informa cada RITE (Anexo 2)', () => {
  it('1.º cuatrimestre: marzo y julio', () => {
    assert.deepEqual(shownBy(Term.FIRST), [MARCH, JULY])
  })

  it('2.º cuatrimestre: hasta diciembre 1', () => {
    assert.deepEqual(shownBy(Term.SECOND), [MARCH, JULY, AUGUST, DECEMBER_TERM_CLOSE])
  })

  it('posterior a la intensificación: los seis, en orden', () => {
    assert.deepEqual(shownBy(Term.SECOND, true), PERIOD_ORDER)
    assert.equal(PERIOD_ORDER.length, 6)
  })

  it('el RITE del 1.º cuatrimestre no muestra un intento de agosto', () => {
    const row = toPendingSubjectRow(
      pendingSubject([attempt(MARCH, 2026, CCA), attempt(AUGUST, 2026, CSA)]),
      2026,
      shownBy(Term.FIRST),
      false
    )
    assert.deepEqual(nonEmpty(row.results), [[MARCH, CCA]])
  })
})

describe('ciclo del intento: sale del calendario y no de la fecha', () => {
  it('febrero/marzo de 2026 (ciclo 2025) cuenta para el RITE 2025 y no para el 2026', () => {
    const attempts = [attempt(DECEMBER, 2025, CCA), attempt(FEBRUARY_MARCH, 2025, CSA)]
    const rite2025 = toPendingSubjectRow(
      pendingSubject(attempts, { originAcademicYear: { year: 2024 } }),
      2025,
      PERIOD_ORDER,
      true
    )
    assert.deepEqual(nonEmpty(rite2025.results), [
      [DECEMBER, CCA],
      [FEBRUARY_MARCH, CSA],
    ])

    const rite2026 = toPendingSubjectRow(pendingSubject(attempts), 2026, PERIOD_ORDER, true)
    assert.deepEqual(nonEmpty(rite2026.results), [])
  })

  it('el RITE 2026 del 1.º cuatrimestre usa solo los intentos del ciclo 2026', () => {
    const row = toPendingSubjectRow(
      pendingSubject([
        attempt(DECEMBER, 2025, CCA),
        attempt(FEBRUARY_MARCH, 2025, CSA),
        attempt(MARCH, 2026, CSA),
        attempt(JULY, 2026, CCA),
      ]),
      2026,
      shownBy(Term.FIRST),
      false
    )
    assert.deepEqual(nonEmpty(row.results), [
      [MARCH, CSA],
      [JULY, CCA],
    ])
  })

  it('un intento sin período del calendario no entra en ningún ciclo', () => {
    const orphan: PendingAttempt = { ...attempt(MARCH, 2026, AA, 6), schedule: null }
    const row = toPendingSubjectRow(pendingSubject([orphan]), 2026, PERIOD_ORDER, true)
    assert.deepEqual(nonEmpty(row.results), [])
  })

  it('la misma materia con intentos de dos ciclos no mezcla los períodos', () => {
    const row = toPendingSubjectRow(
      pendingSubject([attempt(MARCH, 2025, CSA), attempt(MARCH, 2026, CCA)]),
      2026,
      PERIOD_ORDER,
      true
    )
    assert.deepEqual(nonEmpty(row.results), [[MARCH, CCA]])
  })
})

describe('nota y saberes al cierre', () => {
  it('MPAA sin intentos en el ciclo: la nota de origen y los saberes vacíos', () => {
    const row = toPendingSubjectRow(pendingSubject([]), 2026, PERIOD_ORDER, true)
    assert.equal(row.finalScore, 2)
    assert.equal(row.closingPendingKnowledge, null)
  })

  it('MPAA con AA en el ciclo: la nota de ese intento (4 a 10)', () => {
    const row = toPendingSubjectRow(
      pendingSubject([attempt(MARCH, 2026, CSA), attempt(JULY, 2026, AA, 6)]),
      2026,
      PERIOD_ORDER,
      false // ni siquiera hace falta que el ciclo haya cerrado
    )
    assert.equal(row.finalScore, 6)
    assert.equal(row.closingPendingKnowledge, null)
  })

  it('MPAA pendiente con último intento del ciclo: su nota y sus saberes', () => {
    const row = toPendingSubjectRow(
      pendingSubject([
        attempt(MARCH, 2026, CSA, 1, 'Saberes de marzo'),
        attempt(JULY, 2026, CCA, 3, 'Saberes de julio'),
      ]),
      2026,
      PERIOD_ORDER,
      true
    )
    assert.equal(row.finalScore, 3)
    assert.equal(row.closingPendingKnowledge, 'Saberes de julio')
  })

  it('el último intento se elige por período y no por el orden en que llegan', () => {
    const row = toPendingSubjectRow(
      pendingSubject([
        attempt(JULY, 2026, CCA, 3, 'Saberes de julio'),
        attempt(MARCH, 2026, CSA, 1, 'Saberes de marzo'),
      ]),
      2026,
      PERIOD_ORDER,
      true
    )
    assert.equal(row.closingPendingKnowledge, 'Saberes de julio')
  })

  it('pendiente y con el ciclo sin cerrar: nota y saberes al cierre vacíos', () => {
    const row = toPendingSubjectRow(
      pendingSubject([attempt(MARCH, 2026, CSA, 1, 'Saberes')]),
      2026,
      shownBy(Term.FIRST),
      false
    )
    assert.equal(row.finalScore, null)
    assert.equal(row.closingPendingKnowledge, null)
  })

  it('MPAA acreditada en un ciclo posterior: en el RITE de su ciclo sigue pendiente', () => {
    // Pendiente en 2025, intentos en 2026 sin AA y AA en 2027
    const attempts = [attempt(MARCH, 2026, CSA, 1, 'Saberes 2026'), attempt(MARCH, 2027, AA, 7)]
    const rite2026 = toPendingSubjectRow(pendingSubject(attempts), 2026, PERIOD_ORDER, true)
    assert.equal(rite2026.finalScore, 1)
    assert.equal(rite2026.closingPendingKnowledge, 'Saberes 2026')
    assert.deepEqual(nonEmpty(rite2026.results), [[MARCH, CSA]])

    const rite2027 = toPendingSubjectRow(pendingSubject(attempts), 2027, PERIOD_ORDER, true)
    assert.equal(rite2027.finalScore, 7)
    assert.deepEqual(nonEmpty(rite2027.results), [[MARCH, AA]])
  })

  it('closingValues: sin intentos devuelve la nota de origen, con intentos el último', () => {
    assert.deepEqual(closingValues([], 2), { finalScore: 2, closingPendingKnowledge: null })
    assert.deepEqual(closingValues([], null), { finalScore: null, closingPendingKnowledge: null })
    assert.deepEqual(closingValues([attempt(JULY, 2026, CCA, 3, 'X')], 2), {
      finalScore: 3,
      closingPendingKnowledge: 'X',
    })
  })
})

describe('resultado de cada período', () => {
  it('después del AA, los períodos siguientes quedan vacíos', () => {
    const row = toPendingSubjectRow(
      pendingSubject([
        attempt(MARCH, 2026, CSA),
        attempt(JULY, 2026, AA, 6),
        attempt(AUGUST, 2026, CCA), // dato inconsistente: después del AA
      ]),
      2026,
      PERIOD_ORDER,
      true
    )
    assert.deepEqual(nonEmpty(row.results), [
      [MARCH, CSA],
      [JULY, AA],
    ])
  })

  it('en la tabla va el código en cada período, incluso con AA', () => {
    const row = toPendingSubjectRow(
      pendingSubject([attempt(MARCH, 2026, AA, 5)]),
      2026,
      PERIOD_ORDER,
      true
    )
    assert.equal(row.results[MARCH], AA)
    assert.equal(row.finalScore, 5)
  })
})

describe('saberes iniciales', () => {
  it('MPAA que se originó el ciclo anterior: los que guardó el alta', () => {
    const row = toPendingSubjectRow(pendingSubject([]), 2026, PERIOD_ORDER, false)
    assert.equal(row.initialPendingKnowledge, 'Célula')
  })

  it('MPAA de dos ciclos atrás: los del último intento del ciclo anterior', () => {
    const row = toPendingSubjectRow(
      pendingSubject(
        [
          attempt(MARCH, 2025, CSA, null, 'Saberes de marzo 2025'),
          attempt(FEBRUARY_MARCH, 2025, CCA, null, 'Saberes de febrero'),
        ],
        { originAcademicYear: { year: 2024 }, initialPendingKnowledge: 'Saberes del alta' }
      ),
      2026,
      PERIOD_ORDER,
      false
    )
    assert.equal(row.initialPendingKnowledge, 'Saberes de febrero')
  })

  it('el año de la materia sale de la cursada de origen si está', () => {
    const row = toPendingSubjectRow(
      pendingSubject([], { originEnrollment: { originalGradeLevel: 2, intensifications: [] } }),
      2026,
      PERIOD_ORDER,
      false
    )
    assert.equal(row.gradeLevel, 2)
  })
})

describe('columnas de diciembre y febrero de la página 1', () => {
  // La consulta del RITE ya trae solo los intentos de su ciclo
  const attempts = [
    { period: DECEMBER, score: null, resultCode: CCA },
    { period: FEBRUARY_MARCH, score: 5, resultCode: AA },
  ]

  it('con CCA va el código y sin nota', () => {
    assert.deepEqual(intensificationResultOf(attempts, DECEMBER), { score: null, resultCode: CCA })
  })

  it('con AA van la nota y el código', () => {
    assert.deepEqual(intensificationResultOf(attempts, FEBRUARY_MARCH), {
      score: 5,
      resultCode: AA,
    })
  })

  it('sin intento en el período: vacío', () => {
    assert.deepEqual(intensificationResultOf([], DECEMBER), { score: null, resultCode: null })
  })
})
