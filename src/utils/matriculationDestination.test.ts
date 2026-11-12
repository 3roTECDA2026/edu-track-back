import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PromotionOutcome, StudentStatus } from '@prisma/client'
import { decideDestination } from './matriculationDestination'

describe('CRM-064: decideDestination (Lógica de asignación en Matriculación Continuada)', () => {
  const targetSections = [
    { id: 'sec-2A', grade: 2, division: 'A', shift: 'MORNING', orientation: null },
    { id: 'sec-3A', grade: 3, division: 'A', shift: 'MORNING', orientation: null },
    { id: 'sec-4A-ECO', grade: 4, division: 'A', shift: 'MORNING', orientation: 'ECONOMIA' },
  ]

  it('1. Promoción regular: alumno de 1° A pasa a 2° A', () => {
    const res = decideDestination({
      student: { id: 's1', firstName: 'Juan', lastName: 'Pérez', status: StudentStatus.ACTIVE },
      promotionDecision: { outcome: PromotionOutcome.PROMOTED, pendingCount: 2 },
      currentSection: {
        id: 'sec-1A',
        grade: 1,
        division: 'A',
        shift: 'MORNING',
        orientation: null,
      },
      targetSections,
      alreadyEnrolledInTarget: false,
    })

    assert.equal(res.status, 'enrolled')
    assert.equal(res.targetSectionId, 'sec-2A')
    assert.equal(res.targetSectionName, '2° "A"')
  })

  it('2. Egresado de 6.° año: no se matricula en curso siguiente y se reporta como graduates', () => {
    const res = decideDestination({
      student: { id: 's2', firstName: 'Ana', lastName: 'Gómez', status: StudentStatus.ACTIVE },
      promotionDecision: { outcome: PromotionOutcome.PROMOTED, pendingCount: 0 },
      currentSection: {
        id: 'sec-6A',
        grade: 6,
        division: 'A',
        shift: 'MORNING',
        orientation: null,
      },
      targetSections,
      alreadyEnrolledInTarget: false,
    })

    assert.equal(res.status, 'graduates')
    assert.match(res.reason ?? '', /6.° año/)
  })

  it('3. Derivado al EDTE (5 o más MPAA): no se matricula automáticamente y queda pendingPate', () => {
    const res = decideDestination({
      student: { id: 's3', firstName: 'Carlos', lastName: 'López', status: StudentStatus.ACTIVE },
      promotionDecision: { outcome: PromotionOutcome.REFERRED_TO_EDTE, pendingCount: 5 },
      currentSection: {
        id: 'sec-2A',
        grade: 2,
        division: 'A',
        shift: 'MORNING',
        orientation: null,
      },
      targetSections,
      alreadyEnrolledInTarget: false,
    })

    assert.equal(res.status, 'pendingPate')
    assert.match(res.reason ?? '', /EDTE/)
  })

  it('4. Sección destino faltante: 2° B pasa a 3° B pero 3° B no existe', () => {
    const res = decideDestination({
      student: { id: 's4', firstName: 'Lucía', lastName: 'Martínez', status: StudentStatus.ACTIVE },
      promotionDecision: { outcome: PromotionOutcome.PROMOTED, pendingCount: 1 },
      currentSection: {
        id: 'sec-2B',
        grade: 2,
        division: 'B',
        shift: 'MORNING',
        orientation: null,
      },
      targetSections,
      alreadyEnrolledInTarget: false,
    })

    assert.equal(res.status, 'missingSection')
    assert.match(res.missingSectionDescription ?? '', /3° "B"/)
  })

  it('5. Ya inscripto: estudiante ya registrado en el ciclo destino', () => {
    const res = decideDestination({
      student: { id: 's5', firstName: 'Martín', lastName: 'Fierro', status: StudentStatus.ACTIVE },
      promotionDecision: { outcome: PromotionOutcome.PROMOTED, pendingCount: 0 },
      currentSection: {
        id: 'sec-1A',
        grade: 1,
        division: 'A',
        shift: 'MORNING',
        orientation: null,
      },
      targetSections,
      alreadyEnrolledInTarget: true,
    })

    assert.equal(res.status, 'alreadyEnrolled')
  })

  it('6. Estado inactivo: saltea estudiantes de baja o pase', () => {
    const res = decideDestination({
      student: {
        id: 's6',
        firstName: 'Ramiro',
        lastName: 'Díaz',
        status: StudentStatus.TRANSFER_OUT,
      },
      promotionDecision: { outcome: PromotionOutcome.PROMOTED, pendingCount: 0 },
      currentSection: {
        id: 'sec-1A',
        grade: 1,
        division: 'A',
        shift: 'MORNING',
        orientation: null,
      },
      targetSections,
      alreadyEnrolledInTarget: false,
    })

    assert.equal(res.status, 'skippedStatus')
  })
})
