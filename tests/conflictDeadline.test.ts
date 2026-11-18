import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calculateConflictDeadline } from '../src/utils/conflictDeadline'

const registeredAt = new Date('2026-11-17T12:00:00Z')
const hoursBefore = (hours: number) => new Date(registeredAt.getTime() - hours * 60 * 60 * 1000)

test('CRM-094: sin fecha del suceso no se puede calcular el plazo', () => {
  assert.deepEqual(calculateConflictDeadline(null, registeredAt), {
    withinDeadline: null,
    elapsedHours: null,
  })
})

test('CRM-094: registrado a las 23 horas y 59 minutos está en plazo', () => {
  const occurrence = new Date(registeredAt.getTime() - (24 * 60 - 1) * 60 * 1000)

  assert.deepEqual(calculateConflictDeadline(occurrence, registeredAt), {
    withinDeadline: true,
    elapsedHours: 23,
  })
})

test('CRM-094: exactamente 24 horas ya está fuera de plazo', () => {
  assert.deepEqual(calculateConflictDeadline(hoursBefore(24), registeredAt), {
    withinDeadline: false,
    elapsedHours: 24,
  })
})

test('CRM-094: registrado a las 30 horas está fuera de plazo', () => {
  assert.deepEqual(calculateConflictDeadline(hoursBefore(30), registeredAt), {
    withinDeadline: false,
    elapsedHours: 30,
  })
})

test('CRM-094: un suceso del mismo instante está en plazo con 0 horas', () => {
  assert.deepEqual(calculateConflictDeadline(registeredAt, registeredAt), {
    withinDeadline: true,
    elapsedHours: 0,
  })
})

test('CRM-094: si el suceso quedó apenas después del registro (diferencia de relojes), cuenta como en plazo', () => {
  const occurrence = new Date(registeredAt.getTime() + 1000)

  assert.deepEqual(calculateConflictDeadline(occurrence, registeredAt), {
    withinDeadline: true,
    elapsedHours: 0,
  })
})
