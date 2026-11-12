import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IntensificationModel, IntensificationPeriod } from '@prisma/client'

import { listPendingSubjectAttempts } from '@/services/pendingSubject.service'

type Db = NonNullable<Parameters<typeof listPendingSubjectAttempts>[1]>

// Base falsa: devuelve lo que se le pase, sin tocar la base real
const fakeDb = (pending: unknown) =>
  ({ pendingSubject: { findUnique: async () => pending } }) as unknown as Db

const intensification = (
  id: string,
  period: IntensificationPeriod,
  start: string,
  year: number
) => ({
  id,
  period,
  model: IntensificationModel.MODEL_1,
  resultCode: null,
  score: null,
  evaluationDate: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  schedule: { startDate: new Date(start), endDate: new Date(start), academicYear: { year } },
})

describe('historial de intentos de una MPAA', () => {
  it('404 si la MPAA no existe', async () => {
    await assert.rejects(() => listPendingSubjectAttempts('no-existe', fakeDb(null)), {
      message: 'Materia pendiente no encontrada',
    })
  })

  it('sin intentos, devuelve una lista vacía', async () => {
    const db = fakeDb({ originEnrollment: { intensifications: [] } })
    assert.deepEqual(await listPendingSubjectAttempts('id', db), [])
  })

  it('devuelve los intentos ordenados por fecha', async () => {
    const db = fakeDb({
      originEnrollment: {
        intensifications: [
          intensification('febrero', IntensificationPeriod.FEBRUARY_MARCH, '2026-02-16', 2025),
          intensification('agosto', IntensificationPeriod.AUGUST, '2025-08-11', 2025),
        ],
      },
    })
    const attempts = await listPendingSubjectAttempts('id', db)
    assert.deepEqual(
      attempts.map((item) => item.id),
      ['agosto', 'febrero']
    )
  })
})
