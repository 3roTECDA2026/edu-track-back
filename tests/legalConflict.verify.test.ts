import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'

import { createLegalConflict, verifyLegalConflict } from '../src/services/legalConflict.service'
import { createAttachmentService } from '../src/services/legalConflictAttachment.service'
import { calculateConflictHash } from '../src/utils/conflictDocumentHash'
import { encryptConflictReport } from '../src/utils/conflictEncryption'

process.env.CONFLICT_ENCRYPTION_KEY = randomBytes(32).toString('hex')
process.env.CONFLICT_HASH_KEY = randomBytes(32).toString('hex')

const REPORT = 'Informe confidencial del conflicto'

// Base falsa con lo que usan el alta, los anexos y la verificación (CRM-093)
const createFixture = () => {
  const state = {
    conflicts: [] as Array<Record<string, any>>,
    attachments: [] as Array<Record<string, any>>,
    signatures: [] as Array<Record<string, any>>,
    audits: [] as Array<Record<string, any>>,
  }
  let nextId = 1

  const tx = {
    student: { findUnique: async () => ({ id: 'alumno-1' }) },
    conflictCode: { findUnique: async () => ({ code: 'CON-001' }) },
    legalConflict: {
      create: async ({ data }: any) => {
        const conflict = { id: `conflicto-${nextId++}`, ...data }
        state.conflicts.push(conflict)
        return conflict
      },
      findUnique: async ({ where }: any) => {
        const conflict = state.conflicts.find((c) => c.id === where.id)
        if (!conflict) return null
        return {
          ...conflict,
          attachments: state.attachments.filter((a) => a.conflictId === conflict.id),
          electronicSignature: state.signatures.find((s) => s.conflictId === conflict.id) ?? null,
        }
      },
    },
    legalConflictAttachment: {
      create: async ({ data }: any) => {
        const attachment = { id: `anexo-${nextId++}`, ...data }
        state.attachments.push(attachment)
        return attachment
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.audits.push({ ...data, timestamp: new Date() })
        return data
      },
      findMany: async ({ where }: any) =>
        state.audits.filter(
          (log) =>
            log.action === where.action &&
            where.OR.some(
              (cond: any) =>
                log.affectedEntity === cond.affectedEntity &&
                (typeof cond.entityId === 'string'
                  ? log.entityId === cond.entityId
                  : cond.entityId.in.includes(log.entityId))
            )
        ),
    },
  }

  const db = { $transaction: async (callback: any) => callback(tx) } as any
  const createAttachment = createAttachmentService(db)
  const access = { userId: 'usuario-2', ipAddress: '10.0.0.5' }

  const createConflict = () =>
    createLegalConflict(
      {
        studentId: 'alumno-1',
        authorId: 'usuario-1',
        conflictCode: 'CON-001',
        detailedReport: REPORT,
        ipAddress: '127.0.0.1',
      },
      db
    )

  const addAttachment = (conflictId: string, content = 'Anexo de seguimiento') =>
    createAttachment({ conflictId, authorId: 'usuario-1', content, ipAddress: '127.0.0.1' })

  const verify = (id: string) => verifyLegalConflict(id, access, db)

  return { state, createConflict, addAttachment, verify }
}

test('CRM-093: el alta guarda UUID, fecha y hash, y el hash va también al log', async () => {
  const { state, createConflict } = createFixture()

  const conflict = await createConflict()

  assert.match(conflict.documentUuid, /^[0-9a-f-]{36}$/)
  assert.ok(conflict.registeredAt instanceof Date)
  assert.match(conflict.digitalSignHash, /^[a-f0-9]{64}$/)
  assert.equal(state.audits[0]!.newData.digitalSignHash, conflict.digitalSignHash)
})

test('CRM-093: cada anexo tiene su propio UUID y hash', async () => {
  const { createConflict, addAttachment } = createFixture()
  const conflict = await createConflict()

  const first = await addAttachment(conflict.id)
  const second = await addAttachment(conflict.id)

  assert.notEqual(first.documentUuid, second.documentUuid)
  assert.notEqual(first.digitalSignHash, second.digitalSignHash)
  assert.match(first.digitalSignHash as string, /^[a-f0-9]{64}$/)
})

test('CRM-093: un acta sin cambios, con anexos, está íntegra', async () => {
  const { createConflict, addAttachment, verify } = createFixture()
  const conflict = await createConflict()
  await addAttachment(conflict.id)

  const result = await verify(conflict.id)

  assert.ok(result)
  assert.equal(result.status, 'INTACT')
  assert.equal(result.conflictStatus, 'INTACT')
  assert.equal(result.storedHash, result.calculatedHash)
  assert.equal(result.signature.status, 'UNSIGNED')
  assert.equal(result.attachments.length, 1)
  assert.equal(result.attachments[0]!.status, 'INTACT')
})

test('CRM-093: un informe cambiado en la base da ALTERED', async () => {
  const { state, createConflict, verify } = createFixture()
  const conflict = await createConflict()

  // Simula un cambio directo en PostgreSQL: otro texto cifrado con la clave correcta
  state.conflicts[0]!.detailedReport = encryptConflictReport('Informe adulterado')

  const result = await verify(conflict.id)

  assert.equal(result!.status, 'ALTERED')
  assert.deepEqual(result!.reasons, ['CONTENT_CHANGED'])
})

test('CRM-093: cambiar el informe y el hash guardado se detecta por el log', async () => {
  const { state, createConflict, verify } = createFixture()
  const conflict = await createConflict()

  state.conflicts[0]!.detailedReport = encryptConflictReport('Informe adulterado')
  state.conflicts[0]!.digitalSignHash = 'f'.repeat(64)

  const result = await verify(conflict.id)

  assert.equal(result!.status, 'ALTERED')
  assert.ok(result!.reasons.includes('AUDIT_LOG_MISMATCH'))
})

test('CRM-093: un anexo alterado deja el acta ALTERED y marca solo ese anexo', async () => {
  const { state, createConflict, addAttachment, verify } = createFixture()
  const conflict = await createConflict()
  const intact = await addAttachment(conflict.id, 'Primer anexo')
  const altered = await addAttachment(conflict.id, 'Segundo anexo')

  state.attachments.find((a) => a.id === altered.id)!.content = encryptConflictReport(
    'Segundo anexo adulterado'
  )

  const result = await verify(conflict.id)

  assert.equal(result!.status, 'ALTERED')
  assert.equal(result!.conflictStatus, 'INTACT')
  const byId = new Map(result!.attachments.map((a) => [a.id, a]))
  assert.equal(byId.get(intact.id)!.status, 'INTACT')
  assert.equal(byId.get(altered.id)!.status, 'ALTERED')
  assert.deepEqual(state.audits.at(-1)!.newData.alteredAttachments, [altered.id])
})

test('CRM-093: un contenido que no se puede descifrar da ALTERED, no un error', async () => {
  const { state, createConflict, verify } = createFixture()
  const conflict = await createConflict()

  // Cambia un byte del texto cifrado: el tag de AES-GCM deja de coincidir
  const encrypted = state.conflicts[0]!.detailedReport as string
  state.conflicts[0]!.detailedReport = encrypted.replace(/.$/, (c) => (c === '0' ? '1' : '0'))

  const result = await verify(conflict.id)

  assert.equal(result!.status, 'ALTERED')
  assert.deepEqual(result!.reasons, ['UNREADABLE'])
  assert.equal(result!.calculatedHash, null)
})

test('CRM-093: un acta anterior a CRM-093 (sin hash) da NOT_HASHED', async () => {
  const { state, verify } = createFixture()
  state.conflicts.push({
    id: 'conflicto-viejo',
    documentUuid: 'uuid-viejo',
    studentId: 'alumno-1',
    authorId: 'usuario-1',
    conflictCode: 'CON-001',
    detailedReport: encryptConflictReport(REPORT),
    digitalSignHash: null,
    occurrenceDate: null,
    registeredAt: new Date('2026-11-01T12:00:00Z'),
  })

  const result = await verify('conflicto-viejo')

  assert.equal(result!.status, 'NOT_HASHED')
})

// Acta anterior a CRM-093 (sin hash ni log con hash), con el contenido que se le pase
const legacyConflict = (detailedReport: string) => ({
  id: 'conflicto-viejo',
  documentUuid: 'uuid-viejo',
  studentId: 'alumno-1',
  authorId: 'usuario-1',
  conflictCode: 'CON-001',
  detailedReport,
  digitalSignHash: null,
  occurrenceDate: null,
  registeredAt: new Date('2026-11-01T12:00:00Z'),
})

test('CRM-093: un acta anterior con el contenido ilegible da ALTERED (UNREADABLE)', async () => {
  const { state, verify } = createFixture()
  const encrypted = encryptConflictReport(REPORT)
  // Cambia un byte del texto cifrado: el tag de AES-GCM deja de coincidir
  state.conflicts.push(legacyConflict(encrypted.replace(/.$/, (c) => (c === '0' ? '1' : '0'))))

  const result = await verify('conflicto-viejo')

  assert.equal(result!.status, 'ALTERED')
  assert.equal(result!.conflictStatus, 'ALTERED')
  assert.deepEqual(result!.reasons, ['UNREADABLE'])
})

test('CRM-093: un anexo anterior con el contenido ilegible da ALTERED (UNREADABLE)', async () => {
  const { state, verify } = createFixture()
  state.conflicts.push(legacyConflict(encryptConflictReport(REPORT)))
  state.attachments.push({
    id: 'anexo-viejo',
    conflictId: 'conflicto-viejo',
    authorId: 'usuario-1',
    content: 'v1:no-es-un-cifrado-valido',
    date: new Date('2026-11-02T12:00:00Z'),
    digitalSignHash: null,
    documentUuid: 'uuid-anexo-viejo',
  })

  const result = await verify('conflicto-viejo')

  assert.equal(result!.status, 'ALTERED')
  assert.equal(result!.conflictStatus, 'NOT_HASHED')
  assert.deepEqual(result!.attachments[0], {
    id: 'anexo-viejo',
    documentUuid: 'uuid-anexo-viejo',
    status: 'ALTERED',
    reasons: ['UNREADABLE'],
  })
})

test('CRM-093: un acta nueva sin la copia del hash en el log da ALTERED (AUDIT_LOG_MISSING)', async () => {
  const { state, createConflict, verify } = createFixture()
  const conflict = await createConflict()

  // Simula que falta el log del alta (por ejemplo, el acta se insertó a mano en la base)
  state.audits = state.audits.filter(
    (log) => !(log.affectedEntity === 'LegalConflict' && log.entityId === conflict.id)
  )

  const result = await verify(conflict.id)

  assert.equal(result!.status, 'ALTERED')
  assert.deepEqual(result!.reasons, ['AUDIT_LOG_MISSING'])
})

test('CRM-093: un anexo nuevo sin la copia del hash en el log da ALTERED (AUDIT_LOG_MISSING)', async () => {
  const { state, createConflict, addAttachment, verify } = createFixture()
  const conflict = await createConflict()
  const attachment = await addAttachment(conflict.id)

  state.audits = state.audits.filter(
    (log) => !(log.affectedEntity === 'LegalConflictAttachment' && log.entityId === attachment.id)
  )

  const result = await verify(conflict.id)

  assert.equal(result!.status, 'ALTERED')
  assert.equal(result!.conflictStatus, 'INTACT')
  assert.deepEqual(result!.attachments[0]!.reasons, ['AUDIT_LOG_MISSING'])
})

test('CRM-093: compara el contenido actual con el documentHash de la firma TOTP', async () => {
  const { state, createConflict, verify } = createFixture()
  const conflict = await createConflict()
  const stored = state.conflicts[0]!

  state.signatures.push({
    conflictId: conflict.id,
    signedAt: new Date(),
    documentHash: calculateConflictHash({
      documentUuid: stored.documentUuid,
      studentId: stored.studentId,
      authorId: stored.authorId,
      conflictCode: stored.conflictCode,
      detailedReport: REPORT,
      occurrenceDate: null,
      registeredAt: stored.registeredAt,
      attachments: [],
    }),
  })

  assert.equal((await verify(conflict.id))!.signature.status, 'MATCH')

  stored.detailedReport = encryptConflictReport('Informe adulterado')
  const altered = await verify(conflict.id)
  assert.equal(altered!.signature.status, 'MISMATCH')
  assert.equal(altered!.status, 'ALTERED')
})

test('CRM-093: verificar deja un log sin el contenido del informe', async () => {
  const { state, createConflict, addAttachment, verify } = createFixture()
  const conflict = await createConflict()
  await addAttachment(conflict.id, 'Contenido reservado del anexo')

  await verify(conflict.id)

  const log = state.audits.at(-1)!
  assert.equal(log.action, 'SENSITIVE_VIEW')
  assert.equal(log.userId, 'usuario-2')
  assert.equal(log.newData.operation, 'VERIFY')
  assert.equal(log.newData.status, 'INTACT')
  const serialized = JSON.stringify(log)
  assert.equal(serialized.includes(REPORT), false)
  assert.equal(serialized.includes('Contenido reservado del anexo'), false)
})

test('CRM-093: verificar un acta que no existe devuelve null y no deja log', async () => {
  const { state, verify } = createFixture()

  assert.equal(await verify('no-existe'), null)
  assert.equal(state.audits.length, 0)
})

test('CRM-093: sin clave de cifrado es un error de configuración, no un acta alterada', async () => {
  const { createConflict, verify } = createFixture()
  const conflict = await createConflict()
  const previous = process.env.CONFLICT_ENCRYPTION_KEY
  delete process.env.CONFLICT_ENCRYPTION_KEY
  try {
    await assert.rejects(verify(conflict.id), /CONFLICT_ENCRYPTION_KEY/)
  } finally {
    process.env.CONFLICT_ENCRYPTION_KEY = previous
  }
})
