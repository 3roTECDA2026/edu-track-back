import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'

import { createAttachmentService } from '../src/services/legalConflictAttachment.service'
import { decryptConflictReport } from '../src/utils/conflictEncryption'

process.env.CONFLICT_ENCRYPTION_KEY = randomBytes(32).toString('hex')

const createFixture = () => {
  const state = {
    conflictExists: true,
    auditFails: false,
    attachments: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
    transactionCount: 0,
  }

  const tx = {
    legalConflict: {
      findUnique: async () => (state.conflictExists ? { id: 'conflicto-1' } : null),
    },
    legalConflictAttachment: {
      create: async ({ data }: any) => {
        const attachment = {
          id: 'anexo-1',
          ...data,
          date: new Date('2026-11-10T12:00:00Z'),
        }

        state.attachments.push(attachment)
        return attachment
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        if (state.auditFails) {
          throw new Error('Error de auditoría simulado')
        }

        state.audits.push(data)
        return data
      },
    },
  }

  const db = {
    $transaction: async (callback: any) => {
      state.transactionCount++

      const previousAttachments = [...state.attachments]
      const previousAudits = [...state.audits]

      try {
        return await callback(tx)
      } catch (error) {
        state.attachments = previousAttachments
        state.audits = previousAudits
        throw error
      }
    },
  }

  const create = createAttachmentService(db as any)

  const request = () => ({
    conflictId: 'conflicto-1',
    authorId: 'usuario-1',
    content: 'Seguimiento de la intervención institucional',
    ipAddress: '127.0.0.1',
  })

  return { state, create, request }
}

test('CRM-092: crea un anexo y registra auditoría en una transacción', async () => {
  const { state, create, request } = createFixture()

  const result = await create(request())

  assert.equal(result.id, 'anexo-1')
  assert.equal(result.content, request().content)
  assert.equal(state.transactionCount, 1)
  assert.equal(state.attachments.length, 1)
  assert.equal(state.audits.length, 1)

  const audit = state.audits[0]

  assert.equal(audit.userId, 'usuario-1')
  assert.equal(audit.action, 'CREATE')
  assert.equal(audit.affectedEntity, 'LegalConflictAttachment')
  assert.equal(audit.entityId, 'anexo-1')
  assert.equal(audit.ipAddress, '127.0.0.1')

  assert.deepEqual(audit.newData, {
    conflictId: 'conflicto-1',
    attachmentId: 'anexo-1',
    authorId: 'usuario-1',
    signed: false,
  })
})

test('CRM-092: almacena el contenido cifrado', async () => {
  const { state, create, request } = createFixture()

  await create(request())

  const encryptedContent = state.attachments[0].content as string

  assert.notEqual(encryptedContent, request().content)
  assert.equal(decryptConflictReport(encryptedContent), request().content)
})

test('CRM-092: devuelve 404 cuando el conflicto no existe', async () => {
  const { state, create, request } = createFixture()

  state.conflictExists = false

  await assert.rejects(create(request()), (error: unknown) => {
    const err = error as { status?: number; message?: string }

    assert.equal(err.status, 404)
    assert.match(err.message ?? '', /no encontrado/i)
    return true
  })

  assert.equal(state.attachments.length, 0)
  assert.equal(state.audits.length, 0)
})

test('CRM-092: revierte la creación si falla la auditoría', async () => {
  const { state, create, request } = createFixture()

  state.auditFails = true

  await assert.rejects(create(request()), /Error de auditoría simulado/)

  assert.equal(state.attachments.length, 0)
  assert.equal(state.audits.length, 0)
  assert.equal(state.transactionCount, 1)
})

test('CRM-092: los anexos nuevos no se marcan como firmados', async () => {
  const { state, create, request } = createFixture()

  const result = await create(request())

  assert.equal(result.digitalSignHash, null)
  assert.equal(state.attachments.length, 1)
  assert.equal(state.audits[0].newData.signed, false)
})
