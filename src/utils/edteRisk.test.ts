import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PreliminaryAssessment } from '@prisma/client'

import {
  EDTE_RISK_THRESHOLDS,
  isComplexTrajectory,
  isEarlyWarning,
  isReferred,
  riskLevel,
  worstAssessment,
} from './edteRisk'

const { TEA, TEP, TED } = PreliminaryAssessment

describe('umbrales del semáforo del dashboard del EDTE', () => {
  it('4 MPAA es alerta temprana y 5 deriva (E6-RF-02, A5 inc. 13)', () => {
    assert.equal(EDTE_RISK_THRESHOLDS.earlyWarningPending, 4)
    assert.equal(EDTE_RISK_THRESHOLDS.referredPending, 5)
  })

  it('una TED dispara la alerta (E6-RF-03) y dos son riesgo alto (propuesta del equipo)', () => {
    assert.equal(EDTE_RISK_THRESHOLDS.mediumTedCount, 1)
    assert.equal(EDTE_RISK_THRESHOLDS.highTedCount, 2)
  })
})

describe('semáforo de un alumno', () => {
  describe('por materias pendientes', () => {
    it('hasta 3 MPAA y sin TED: verde', () => {
      for (const pending of [0, 1, 2, 3]) assert.equal(riskLevel(pending, 0, TEA), 'LOW')
    })

    it('4 MPAA: ámbar', () => {
      assert.equal(riskLevel(4, 0, TEA), 'MEDIUM')
    })

    it('5 o más MPAA: rojo', () => {
      for (const pending of [5, 6, 12]) assert.equal(riskLevel(pending, 0, TEA), 'HIGH')
    })
  })

  describe('por materias con TED', () => {
    it('una TED: ámbar', () => {
      assert.equal(riskLevel(0, 1, TED), 'MEDIUM')
    })

    it('dos o más TED: rojo', () => {
      assert.equal(riskLevel(0, 2, TED), 'HIGH')
      assert.equal(riskLevel(0, 5, TED), 'HIGH')
    })
  })

  describe('por valoración', () => {
    it('TEP sin otras señales: ámbar', () => {
      assert.equal(riskLevel(0, 0, TEP), 'MEDIUM')
    })

    it('TEA o sin valoración: verde', () => {
      assert.equal(riskLevel(0, 0, TEA), 'LOW')
      assert.equal(riskLevel(0, 0, null), 'LOW')
    })
  })

  it('gana el peor de los criterios', () => {
    // 4 MPAA (ámbar) y 2 TED (rojo): rojo
    assert.equal(riskLevel(4, 2, TED), 'HIGH')
    // 3 MPAA (verde) con una TED (ámbar): ámbar
    assert.equal(riskLevel(3, 1, TED), 'MEDIUM')
  })
})

describe('alerta temprana y derivados', () => {
  it('alerta temprana: solo con 4 (con 5 ya es derivado)', () => {
    assert.equal(isEarlyWarning(3), false)
    assert.equal(isEarlyWarning(4), true)
    assert.equal(isEarlyWarning(5), false)
  })

  it('derivado: 5 o más', () => {
    assert.equal(isReferred(4), false)
    assert.equal(isReferred(5), true)
    assert.equal(isReferred(8), true)
  })

  it('un alumno no es alerta temprana y derivado a la vez', () => {
    for (const pending of [0, 1, 2, 3, 4, 5, 6, 7]) {
      assert.equal(isEarlyWarning(pending) && isReferred(pending), false)
    }
  })
})

describe('trayectoria compleja (entra en el listado)', () => {
  it('4 o más MPAA', () => {
    assert.equal(isComplexTrajectory(3, 0, false), false)
    assert.equal(isComplexTrajectory(4, 0, false), true)
  })

  it('alguna TED en el cuatrimestre, aunque no tenga MPAA', () => {
    assert.equal(isComplexTrajectory(0, 1, false), true)
  })

  it('PATE en curso, aunque no tenga otras señales', () => {
    assert.equal(isComplexTrajectory(0, 0, true), true)
  })

  it('sin ninguna de las tres: no entra', () => {
    assert.equal(isComplexTrajectory(0, 0, false), false)
  })
})

describe('peor valoración de un alumno', () => {
  it('TED gana a TEP y a TEA', () => {
    assert.equal(worstAssessment([TEA, TEP, TED]), TED)
  })

  it('TEP gana a TEA', () => {
    assert.equal(worstAssessment([TEA, TEA, TEP]), TEP)
  })

  it('solo TEA', () => {
    assert.equal(worstAssessment([TEA, TEA]), TEA)
  })

  it('sin valoraciones cargadas: ninguna', () => {
    assert.equal(worstAssessment([]), null)
  })
})
