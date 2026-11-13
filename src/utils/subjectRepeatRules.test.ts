import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PendingSubjectStatus } from '@prisma/client'

import {
  deleteBlockReason,
  repeatBlockReason,
  type RepeatPendingInfo,
  type RepeatSectionInfo,
} from './subjectRepeatRules'

const activeCycle = { id: 'ciclo-2026', year: 2026 }

// MPAA de 2.º año que quedó pendiente en 2025, sin intentos de intensificación
const pending = (overrides: Partial<RepeatPendingInfo> = {}): RepeatPendingInfo => ({
  status: PendingSubjectStatus.PENDING,
  originYear: 2025,
  gradeLevel: 2,
  attempts: [],
  ...overrides,
})

// Sección de 2.º año del ciclo activo
const section = (overrides: Partial<RepeatSectionInfo> = {}): RepeatSectionInfo => ({
  academicYearId: 'ciclo-2026',
  grade: 2,
  ...overrides,
})

describe('recursado de una MPAA (CRM-082)', () => {
  it('se puede con una MPAA pendiente de un ciclo anterior y una sección del año de la materia', () => {
    assert.equal(repeatBlockReason(pending(), section(), activeCycle), null)
  })

  it('no se puede si la MPAA ya está acreditada', () => {
    const reason = repeatBlockReason(
      pending({ status: PendingSubjectStatus.ACCREDITED }),
      section(),
      activeCycle
    )
    assert.match(reason ?? '', /acreditada/)
  })

  it('no se puede recursar en el mismo ciclo en que quedó pendiente', () => {
    const reason = repeatBlockReason(pending({ originYear: 2026 }), section(), activeCycle)
    assert.match(reason ?? '', /ciclo posterior/)
  })

  it('no se puede en una sección de otro ciclo', () => {
    const reason = repeatBlockReason(
      pending(),
      section({ academicYearId: 'ciclo-2025' }),
      activeCycle
    )
    assert.match(reason ?? '', /no es del ciclo 2026/)
  })

  it('no se puede en una sección de otro año que la materia', () => {
    const reason = repeatBlockReason(pending(), section({ grade: 3 }), activeCycle)
    assert.match(reason ?? '', /2\.º año/)
  })

  it('no se puede con una intensificación sin resultado', () => {
    const reason = repeatBlockReason(
      pending({ attempts: [{ resultCode: 'CCA' }, { resultCode: null }] }),
      section(),
      activeCycle
    )
    assert.match(reason ?? '', /intensificación sin resultado/)
  })

  it('se puede si los intentos de intensificación ya tienen resultado', () => {
    const reason = repeatBlockReason(
      pending({ attempts: [{ resultCode: 'CSA' }] }),
      section(),
      activeCycle
    )
    assert.equal(reason, null)
  })
})

describe('quitar un recursado (CRM-082)', () => {
  const unused = { hasGrade: false, attendances: 0, intensifications: 0 }

  it('se puede si no tiene notas, asistencias ni intensificaciones', () => {
    assert.equal(deleteBlockReason(unused), null)
  })

  it('no se puede con notas', () => {
    assert.match(deleteBlockReason({ ...unused, hasGrade: true }) ?? '', /notas/)
  })

  it('no se puede con asistencias', () => {
    assert.match(deleteBlockReason({ ...unused, attendances: 3 }) ?? '', /asistencias/)
  })

  it('no se puede con intensificaciones', () => {
    assert.match(deleteBlockReason({ ...unused, intensifications: 1 }) ?? '', /intensificaciones/)
  })
})
