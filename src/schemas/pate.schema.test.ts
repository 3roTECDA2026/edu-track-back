import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createPateSchema } from './pate.schema'

const GUID = '00000000-0000-0000-0000-000000000102'
const MEETING = '00000000-0000-0000-0000-000000005401'

// Lo mínimo para dar de alta un PATE
const input = (overrides: Record<string, unknown> = {}) => ({
  studentId: GUID,
  edteMeetingId: MEETING,
  diagnosis: 'Dificultades en el área de Ciencias Sociales.',
  supportStrategies: 'Tutorías semanales.',
  ...overrides,
})

describe('alta de un PATE (CRM-078)', () => {
  it('con la reunión del EDTE, es válida', () => {
    assert.doesNotThrow(() => createPateSchema.parse(input()))
  })

  it('sin la reunión del EDTE, se rechaza: el PATE sale de una reunión (CRM-075)', () => {
    const { edteMeetingId: _omitted, ...withoutMeeting } = input()
    assert.throws(() => createPateSchema.parse(withoutMeeting))
    assert.throws(() => createPateSchema.parse(input({ edteMeetingId: null })))
  })
})
