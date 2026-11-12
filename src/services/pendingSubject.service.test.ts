import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PendingSubjectStatus } from '@prisma/client'

import { HttpError } from '@/utils/httpError'

import { updatePendingKnowledge } from './pendingSubject.service'

type Db = Parameters<typeof updatePendingKnowledge>[2]

// Base falsa: devuelve la MPAA indicada y anota lo que se intenta guardar
const fakeDb = (found: { status: PendingSubjectStatus; subject: { name: string } } | null) => {
  const updates: Array<{ data: unknown }> = []
  const db = {
    pendingSubject: {
      findUnique: async () => found,
      update: async (args: { data: unknown }) => {
        updates.push(args)
        return {}
      },
    },
  } as unknown as Db
  return { db, updates }
}

const pending = { status: PendingSubjectStatus.PENDING, subject: { name: 'Lengua' } }
const accredited = { status: PendingSubjectStatus.ACCREDITED, subject: { name: 'Lengua' } }
const isStatus = (status: number) => (err: unknown) =>
  err instanceof HttpError && err.status === status

describe('guardar los saberes de una MPAA', () => {
  it('404 si la MPAA no existe', async () => {
    const { db } = fakeDb(null)
    await assert.rejects(
      updatePendingKnowledge('id', { closingPendingKnowledge: 'x' }, db),
      isStatus(404)
    )
  })

  it('409 si la MPAA ya está acreditada, y no guarda nada', async () => {
    const { db, updates } = fakeDb(accredited)
    await assert.rejects(
      updatePendingKnowledge('id', { closingPendingKnowledge: 'x' }, db),
      isStatus(409)
    )
    assert.equal(updates.length, 0)
  })

  it('guarda solo el campo que llegó', async () => {
    const { db, updates } = fakeDb(pending)
    await updatePendingKnowledge('id', { closingPendingKnowledge: 'Argumentación' }, db)
    assert.deepEqual(updates[0]?.data, { closingPendingKnowledge: 'Argumentación' })
  })

  it('null borra el campo', async () => {
    const { db, updates } = fakeDb(pending)
    await updatePendingKnowledge('id', { initialPendingKnowledge: null }, db)
    assert.deepEqual(updates[0]?.data, { initialPendingKnowledge: null })
  })
})
