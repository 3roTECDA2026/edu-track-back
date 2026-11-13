import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  IntensificationModel,
  IntensificationPeriod,
  IntensificationResultCode,
} from '@prisma/client'

import { sortAttemptsByDate, toAttemptsResponse, type AttemptRecord } from './pendingAttempts'

const schedule = (start: string, end: string, year: number) => ({
  startDate: new Date(start),
  endDate: new Date(end),
  academicYear: { year },
})

const attempt = (overrides: Partial<AttemptRecord> & { id: string }): AttemptRecord => ({
  period: IntensificationPeriod.DECEMBER,
  model: IntensificationModel.MODEL_1,
  resultCode: null,
  score: null,
  evaluationDate: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  schedule: null,
  ...overrides,
})

const august2025 = attempt({
  id: 'agosto',
  period: IntensificationPeriod.AUGUST,
  schedule: schedule('2025-08-11', '2025-08-22', 2025),
})
const december2025 = attempt({
  id: 'diciembre',
  period: IntensificationPeriod.DECEMBER,
  schedule: schedule('2025-12-01', '2025-12-12', 2025),
})
const february2026 = attempt({
  id: 'febrero',
  period: IntensificationPeriod.FEBRUARY_MARCH,
  schedule: schedule('2026-02-16', '2026-03-06', 2025),
})

const ids = (attempts: { id: string }[]) => attempts.map((item) => item.id)

describe('orden de los intentos de una MPAA', () => {
  it('va del más viejo al más nuevo, sin importar el orden en que llegan', () => {
    const sorted = sortAttemptsByDate([february2026, august2025, december2025])
    assert.deepEqual(ids(sorted), ['agosto', 'diciembre', 'febrero'])
  })

  it('no modifica la lista original', () => {
    const original = [february2026, august2025]
    sortAttemptsByDate(original)
    assert.deepEqual(ids(original), ['febrero', 'agosto'])
  })

  it('un intento sin calendario se ordena por su fecha de evaluación', () => {
    const noSchedule = attempt({ id: 'sin-calendario', evaluationDate: new Date('2025-10-01') })
    const sorted = sortAttemptsByDate([december2025, noSchedule, august2025])
    assert.deepEqual(ids(sorted), ['agosto', 'sin-calendario', 'diciembre'])
  })

  it('sin calendario ni evaluación, se ordena por la fecha de registro', () => {
    const noSchedule = attempt({ id: 'sin-calendario', createdAt: new Date('2025-10-01') })
    const sorted = sortAttemptsByDate([december2025, noSchedule, august2025])
    assert.deepEqual(ids(sorted), ['agosto', 'sin-calendario', 'diciembre'])
  })

  it('con la misma fecha, va primero el que se registró antes', () => {
    const first = attempt({ id: 'primero', createdAt: new Date('2025-01-01') })
    const second = attempt({ id: 'segundo', createdAt: new Date('2025-01-02') })
    const sorted = sortAttemptsByDate([second, first])
    assert.deepEqual(ids(sorted), ['primero', 'segundo'])
  })
})

describe('respuesta del historial de intentos', () => {
  it('sin intentos, devuelve una lista vacía', () => {
    assert.deepEqual(toAttemptsResponse([]), [])
  })

  it('el ciclo sale del calendario: febrero/marzo de 2026 es del ciclo 2025', () => {
    const [item] = toAttemptsResponse([february2026])
    assert.equal(item?.cycleYear, 2025)
    assert.deepEqual(item?.startDate, new Date('2026-02-16'))
    assert.deepEqual(item?.endDate, new Date('2026-03-06'))
  })

  it('un intento sin calendario no tiene ciclo ni fechas de período', () => {
    const [item] = toAttemptsResponse([attempt({ id: 'viejo' })])
    assert.equal(item?.cycleYear, null)
    assert.equal(item?.startDate, null)
    assert.equal(item?.endDate, null)
  })

  it('un intento sin resultado lo deja en null, y uno con resultado trae código y nota', () => {
    const pending = attempt({
      id: 'pendiente',
      schedule: schedule('2025-08-11', '2025-08-22', 2025),
    })
    const accredited = attempt({
      id: 'acreditado',
      resultCode: IntensificationResultCode.AA,
      score: 7,
      schedule: schedule('2025-12-01', '2025-12-12', 2025),
    })
    const [first, second] = toAttemptsResponse([accredited, pending])
    assert.equal(first?.resultCode, null)
    assert.equal(first?.score, null)
    assert.equal(second?.resultCode, IntensificationResultCode.AA)
    assert.equal(second?.score, 7)
  })
})
