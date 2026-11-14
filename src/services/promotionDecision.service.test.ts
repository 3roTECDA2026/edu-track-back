import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PromotionOutcome, StudentStatus } from '@prisma/client'

import { getReferredStudentIds } from './promotionDecision.service'

type Db = NonNullable<Parameters<typeof getReferredStudentIds>[2]>

// Base falsa: devuelve las decisiones indicadas y anota con qué filtros se consultó
const fakeDb = (rows: Array<{ studentId: string }>) => {
  const calls: Array<{ where: Record<string, unknown> }> = []
  const db = {
    promotionDecision: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        calls.push(args)
        return rows
      },
    },
  } as unknown as Db
  return { db, calls }
}

describe('alumnos derivados al EDTE según el motor de promoción (CRM-073)', () => {
  it('lee las decisiones REFERRED_TO_EDTE del ciclo cerrado, de alumnos activos o condicionales', async () => {
    const { db, calls } = fakeDb([{ studentId: 'a' }, { studentId: 'b' }])
    assert.deepEqual(await getReferredStudentIds(2025, undefined, db), ['a', 'b'])
    assert.deepEqual(calls[0]?.where, {
      outcome: PromotionOutcome.REFERRED_TO_EDTE,
      academicYear: { year: 2025 },
      student: { status: { in: [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL] } },
    })
  })

  it('con una lista de alumnos, consulta solo esos', async () => {
    const { db, calls } = fakeDb([{ studentId: 'a' }])
    await getReferredStudentIds(2025, ['a'], db)
    assert.deepEqual(calls[0]?.where.studentId, { in: ['a'] })
  })

  it('sin decisiones del motor, no hay derivados', async () => {
    const { db } = fakeDb([])
    assert.deepEqual(await getReferredStudentIds(2025, ['a'], db), [])
  })
})
