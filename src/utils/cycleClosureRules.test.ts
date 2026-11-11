import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IntensificationPeriod } from '@prisma/client'

import {
  closingFinalScore,
  initialPendingKnowledge,
  type ClosureEnrollment,
} from './cycleClosureRules'

const { DECEMBER, FEBRUARY_MARCH } = IntensificationPeriod

const enrollment = (
  intensifications: ClosureEnrollment['intensifications'],
  rationale2: string | null = null
): ClosureEnrollment => ({ intensifications, grade: { rationale2 } })

const attempt = (
  period: IntensificationPeriod,
  score: number | null,
  pendingKnowledge: string | null = null
) => ({ period, score, pendingKnowledge })

describe('nota final de la MPAA al cierre del ciclo (Anexo 5, inc. 8.d)', () => {
  it('es la del último período: febrero/marzo antes que diciembre', () => {
    assert.equal(
      closingFinalScore(enrollment([attempt(DECEMBER, 1), attempt(FEBRUARY_MARCH, 3)])),
      3
    )
  })

  it('no depende del orden en que llegan los intentos', () => {
    assert.equal(
      closingFinalScore(enrollment([attempt(FEBRUARY_MARCH, 3), attempt(DECEMBER, 1)])),
      3
    )
  })

  it('si solo participó en diciembre, es la de diciembre', () => {
    assert.equal(closingFinalScore(enrollment([attempt(DECEMBER, 2)])), 2)
  })

  it('sin intentos, queda vacía', () => {
    assert.equal(closingFinalScore(enrollment([])), null)
  })

  it('si el docente no cargó la nota de febrero/marzo, queda vacía (no toma la de diciembre)', () => {
    assert.equal(
      closingFinalScore(enrollment([attempt(DECEMBER, 2), attempt(FEBRUARY_MARCH, null)])),
      null
    )
  })
})

describe('saberes pendientes al inicio del ciclo siguiente', () => {
  it('son los del último intento: febrero/marzo antes que diciembre', () => {
    assert.equal(
      initialPendingKnowledge(
        enrollment([
          attempt(DECEMBER, null, 'De diciembre'),
          attempt(FEBRUARY_MARCH, null, 'De febrero'),
        ])
      ),
      'De febrero'
    )
  })

  it('si febrero/marzo no tiene saberes, usa los de diciembre', () => {
    assert.equal(
      initialPendingKnowledge(
        enrollment([attempt(DECEMBER, null, 'De diciembre'), attempt(FEBRUARY_MARCH, null, null)])
      ),
      'De diciembre'
    )
  })

  it('un texto en blanco cuenta como vacío', () => {
    assert.equal(
      initialPendingKnowledge(
        enrollment([attempt(DECEMBER, null, 'De diciembre'), attempt(FEBRUARY_MARCH, null, '   ')])
      ),
      'De diciembre'
    )
  })

  it('sin intentos, usa la fundamentación del 2.º cuatrimestre', () => {
    assert.equal(initialPendingKnowledge(enrollment([], 'Fundamentación')), 'Fundamentación')
  })

  it('sin intentos ni fundamentación, queda vacío', () => {
    assert.equal(initialPendingKnowledge(enrollment([], '  ')), null)
    assert.equal(initialPendingKnowledge({ intensifications: [], grade: null }), null)
  })
})
