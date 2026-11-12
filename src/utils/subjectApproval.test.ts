import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IntensificationResultCode } from '@prisma/client'

import { evaluateSubjectApproval, type SubjectApprovalInput } from './subjectApproval'

const { AA, CCA, CSA } = IntensificationResultCode

// Materia con las notas de los dos cuatrimestres (sin recuperación ni intensificación)
const subject = (overrides: Partial<SubjectApprovalInput> = {}): SubjectApprovalInput => ({
  term1Score: 7,
  term2Score: 8,
  term1IntensificationScore: null,
  attempts: [],
  ...overrides,
})

describe('aprobación de una materia del ciclo (Res. 1650/24, Anexo 5)', () => {
  describe('con los dos cuatrimestres aprobados', () => {
    it('la nota final es el promedio sin redondear (7 y 8 → 7,5)', () => {
      assert.deepEqual(evaluateSubjectApproval(subject()), { outcome: 'APPROVED', finalScore: 7.5 })
    })

    it('7 y 7 aprueban con 7', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term1Score: 7, term2Score: 7 })), {
        outcome: 'APPROVED',
        finalScore: 7,
      })
    })

    it('el promedio admite decimales (9 y 10 → 9,5)', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term1Score: 9, term2Score: 10 })), {
        outcome: 'APPROVED',
        finalScore: 9.5,
      })
    })
  })

  describe('el límite de aprobación es 7', () => {
    it('6,5 no aprueba el 2.º cuatrimestre', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term2Score: 6.5 })), {
        outcome: 'NOT_APPROVED',
      })
    })

    it('7 aprueba el 2.º cuatrimestre', () => {
      assert.equal(evaluateSubjectApproval(subject({ term2Score: 7 })).outcome, 'APPROVED')
    })

    it('desaprobar el 2.º con el 1.º aprobado no aprueba la materia', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term1Score: 9, term2Score: 4 })), {
        outcome: 'NOT_APPROVED',
      })
    })
  })

  describe('1.º cuatrimestre recuperado durante el 2.º (inc. 8.b)', () => {
    it('con el 2.º aprobado y la recuperación aprobada, la nota final es la de la recuperación', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term1Score: 4, term2Score: 8, term1IntensificationScore: 7 })
        ),
        { outcome: 'APPROVED', finalScore: 7 }
      )
    })

    it('con la recuperación desaprobada, no aprueba', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term1Score: 4, term2Score: 8, term1IntensificationScore: 6 })
        ),
        { outcome: 'NOT_APPROVED' }
      )
    })

    it('sin recuperación, no aprueba', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term1Score: 4, term2Score: 8 })), {
        outcome: 'NOT_APPROVED',
      })
    })

    it('recuperar el 1.º no alcanza si el 2.º está desaprobado', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term1Score: 4, term2Score: 5, term1IntensificationScore: 8 })
        ),
        { outcome: 'NOT_APPROVED' }
      )
    })

    it('sin nota del 1.º pero con recuperación aprobada, usa la recuperación', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term1Score: null, term2Score: 8, term1IntensificationScore: 7 })
        ),
        { outcome: 'APPROVED', finalScore: 7 }
      )
    })

    it('si el 1.º ya estaba aprobado, la recuperación no cambia el promedio', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term1Score: 8, term2Score: 8, term1IntensificationScore: 9 })
        ),
        { outcome: 'APPROVED', finalScore: 8 }
      )
    })
  })

  describe('intensificación de diciembre y febrero/marzo', () => {
    it('con AA, la materia queda aprobada con la nota de ese intento', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({
            term1Score: 3,
            term2Score: 4,
            attempts: [
              { resultCode: CCA, score: null },
              { resultCode: AA, score: 6 },
            ],
          })
        ),
        { outcome: 'APPROVED', finalScore: 6 }
      )
    })

    it('con AA sin nota cargada, aprueba y la nota queda vacía', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term1Score: 3, term2Score: 4, attempts: [{ resultCode: AA, score: null }] })
        ),
        { outcome: 'APPROVED', finalScore: null }
      )
    })

    it('con CCA y CSA, sigue sin aprobar', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({
            term1Score: 3,
            term2Score: 4,
            attempts: [
              { resultCode: CCA, score: null },
              { resultCode: CSA, score: null },
            ],
          })
        ),
        { outcome: 'NOT_APPROVED' }
      )
    })

    it('el AA gana aunque las notas de los cuatrimestres alcancen para otra cosa', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term1Score: 9, term2Score: 9, attempts: [{ resultCode: AA, score: 5 }] })
        ),
        { outcome: 'APPROVED', finalScore: 5 }
      )
    })
  })

  describe('materias sin las notas necesarias', () => {
    it('sin nota del 2.º y sin intensificar: no se sabe, no pasa a MPAA', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term2Score: null })), {
        outcome: 'UNRATED',
      })
    })

    it('sin nota del 1.º ni recuperación: no se sabe', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term1Score: null })), {
        outcome: 'UNRATED',
      })
    })

    it('sin ninguna nota: no se sabe', () => {
      assert.deepEqual(evaluateSubjectApproval(subject({ term1Score: null, term2Score: null })), {
        outcome: 'UNRATED',
      })
    })

    it('si ya intensificó y no aprobó, sí se sabe que desaprobó aunque falten notas', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({
            term1Score: null,
            term2Score: null,
            attempts: [{ resultCode: CSA, score: null }],
          })
        ),
        { outcome: 'NOT_APPROVED' }
      )
    })

    it('un intento sin resultado cargado no cuenta como haber intensificado', () => {
      assert.deepEqual(
        evaluateSubjectApproval(
          subject({ term2Score: null, attempts: [{ resultCode: null, score: null }] })
        ),
        { outcome: 'UNRATED' }
      )
    })
  })
})
