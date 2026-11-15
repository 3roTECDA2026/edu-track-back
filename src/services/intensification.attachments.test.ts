import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { HttpError } from '@/utils/httpError'

import { assertNoAttachments } from './intensification.service'

type Db = NonNullable<Parameters<typeof assertNoAttachments>[1]>

// Base falsa: cuenta las evidencias del intento (vigentes y dadas de baja)
const fakeDb = (count: number) => {
  const queries: unknown[] = []
  const db = {
    intensificationAttachment: {
      count: async (args: unknown) => {
        queries.push(args)
        return count
      },
    },
  } as unknown as Db
  return { db, queries }
}

describe('quitar una asignación con evidencias (CRM-060)', () => {
  it('409 si el intento tiene evidencias', async () => {
    const { db } = fakeDb(1)
    await assert.rejects(
      assertNoAttachments('i1', db),
      (err: unknown) => err instanceof HttpError && err.status === 409
    )
  })

  it('cuenta también las dadas de baja: no filtra por deletedAt', async () => {
    const { db, queries } = fakeDb(0)
    await assertNoAttachments('i1', db)
    assert.deepEqual(queries[0], { where: { intensificationId: 'i1' } })
  })
})
