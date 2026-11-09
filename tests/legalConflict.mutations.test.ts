import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLegalConflictMutations } from '../src/services/legalConflict.service'
import { encryptConflictReport } from '../src/utils/conflictEncryption'

const ID = '11111111-1111-4111-8111-111111111111'

const audit = {
  userId: '22222222-2222-4222-8222-222222222222',
  ipAddress: '127.0.0.1',
}

// Clave temporal solo para las pruebas; no modifica archivos .env.
process.env.CONFLICT_ENCRYPTION_KEY = 'a'.repeat(64)

function mockDb(signed = false) {
  const calls: string[] = []

  const conflict = {
    id: ID,
    editLocked: signed,
    digitalSignHash: signed ? 'hash-firmado' : null,
    electronicSignature: signed ? { id: 'firma-1' } : null,
    detailedReport: encryptConflictReport('Informe de prueba'),
    studentId: 'student-1',
    authorId: 'author-1',
    conflictCode: 'CONFLICTO-ORIGINAL',
    occurrenceDate: null,
  }

  const tx = {
    $queryRaw: async () => {
      calls.push('lock')
      return [{ id: ID }]
    },
    legalConflict: {
      findUnique: async () => {
        calls.push('find')
        return conflict
      },
      update: async ({ data }: any) => {
        calls.push('update')
        return { ...conflict, ...data }
      },
      delete: async () => {
        calls.push('delete')
        return conflict
      },
    },
    auditLog: {
      create: async () => {
        calls.push('audit')
        return { id: 'audit-1' }
      },
    },
    legalConflictAttachment: {
      deleteMany: async () => {
        calls.push('deleteAttachments')
        return { count: 1 }
      },
    },
  }

  const db = {
    $transaction: async (callback: any) => callback(tx),
  }

  return { db, calls }
}

test('permite editar un acta sin firmar', async () => {
  const { db, calls } = mockDb(false)
  const service = createLegalConflictMutations(db as any)

  const result = await service.updateLegalConflict(ID, {
    conflictCode: 'CONFLICTO-01',
  }, audit)

  assert.equal(result.conflictCode, 'CONFLICTO-01')
  assert.deepEqual(calls, ['lock', 'find', 'update', 'audit'])
})

test('permite eliminar un acta sin firmar y sus anexos', async () => {
  const { db, calls } = mockDb(false)
  const service = createLegalConflictMutations(db as any)

  const result = await service.deleteLegalConflict(ID, audit)

  assert.deepEqual(result, { deleted: true, id: ID })
  assert.deepEqual(calls, [
    'lock',
    'find',
    'deleteAttachments',
    'delete',
    'audit',
  ])
})

test('impide editar un acta firmada', async () => {
  const { db, calls } = mockDb(true)
  const service = createLegalConflictMutations(db as any)

  await assert.rejects(
    service.updateLegalConflict(ID, {
      conflictCode: 'CONFLICTO-02',
    }, audit),
    (error: any) => error.statusCode === 409 || error.status === 409
  )

  assert.equal(calls.includes('update'), false)
})

test('impide eliminar un acta firmada', async () => {
  const { db, calls } = mockDb(true)
  const service = createLegalConflictMutations(db as any)

  await assert.rejects(
    service.deleteLegalConflict(ID, audit),
    (error: any) => error.statusCode === 409 || error.status === 409
  )

  assert.equal(calls.includes('delete'), false)
  assert.equal(calls.includes('deleteAttachments'), false)
})
