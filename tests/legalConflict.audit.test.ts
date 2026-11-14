import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'

import {
  createLegalConflict,
  getLegalConflictById,
  getLegalConflictsByStudent,
} from '../src/services/legalConflict.service'
import { encryptConflictReport } from '../src/utils/conflictEncryption'

process.env.CONFLICT_ENCRYPTION_KEY = randomBytes(32).toString('hex')

const REPORT = 'Informe confidencial del conflicto'

const createFixture = () => {
  const state = {
    studentExists: true,
    auditFails: false,
    conflicts: [] as Array<Record<string, any>>,
    audits: [] as Array<Record<string, any>>,
  }

  const tx = {
    student: {
      findUnique: async () => (state.studentExists ? { id: 'alumno-1' } : null),
    },
    conflictCode: {
      findUnique: async () => ({ code: 'CON-001' }),
    },
    legalConflict: {
      create: async ({ data }: any) => {
        const conflict = {
          id: 'conflicto-1',
          ...data,
          registeredAt: new Date('2026-11-10T12:00:00Z'),
        }
        state.conflicts.push(conflict)
        return conflict
      },
      findUnique: async ({ where }: any) => {
        const conflict = state.conflicts.find((c) => c.id === where.id)
        return conflict ? { ...conflict, attachments: [] } : null
      },
      findMany: async ({ where }: any) =>
        state.conflicts.filter((c) => c.studentId === where.studentId),
    },
    user: {
      findMany: async () => [],
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
      const previousConflicts = [...state.conflicts]
      const previousAudits = [...state.audits]

      try {
        return await callback(tx)
      } catch (error) {
        state.conflicts = previousConflicts
        state.audits = previousAudits
        throw error
      }
    },
  }

  const seedConflict = () => {
    state.conflicts.push({
      id: 'conflicto-1',
      studentId: 'alumno-1',
      authorId: 'usuario-1',
      conflictCode: 'CON-001',
      detailedReport: encryptConflictReport(REPORT),
      digitalSignHash: null,
      editLocked: true,
      occurrenceDate: null,
      registeredAt: new Date('2026-11-10T12:00:00Z'),
    })
  }

  return { state, db: db as any, seedConflict }
}

const creation = {
  studentId: 'alumno-1',
  authorId: 'usuario-1',
  conflictCode: 'CON-001',
  detailedReport: REPORT,
  ipAddress: '127.0.0.1',
}

const access = { userId: 'usuario-2', ipAddress: '10.0.0.5' }

test('CRM-095: el alta de un conflicto registra el log con solo referencias', async () => {
  const { state, db } = createFixture()

  const result = await createLegalConflict(creation, db)

  assert.equal(result.id, 'conflicto-1')
  assert.equal(state.audits.length, 1)

  const audit = state.audits[0]

  assert.equal(audit.userId, 'usuario-1')
  assert.equal(audit.action, 'CREATE')
  assert.equal(audit.affectedEntity, 'LegalConflict')
  assert.equal(audit.entityId, 'conflicto-1')
  assert.equal(audit.ipAddress, '127.0.0.1')
  assert.deepEqual(audit.newData, {
    conflictId: 'conflicto-1',
    studentId: 'alumno-1',
    conflictCode: 'CON-001',
    authorId: 'usuario-1',
  })
})

test('CRM-095: el alta no guarda el informe en el log', async () => {
  const { state, db } = createFixture()

  await createLegalConflict(creation, db)

  assert.equal(JSON.stringify(state.audits).includes(REPORT), false)
})

test('CRM-095: si falla el log, el alta se revierte', async () => {
  const { state, db } = createFixture()

  state.auditFails = true

  await assert.rejects(createLegalConflict(creation, db), /Error de auditoría simulado/)

  assert.equal(state.conflicts.length, 0)
  assert.equal(state.audits.length, 0)
})

test('CRM-095: un alta con alumno inexistente da 404 y no deja log', async () => {
  const { state, db } = createFixture()

  state.studentExists = false

  await assert.rejects(createLegalConflict(creation, db), (error: unknown) => {
    assert.equal((error as { status?: number }).status, 404)
    return true
  })

  assert.equal(state.conflicts.length, 0)
  assert.equal(state.audits.length, 0)
})

test('CRM-095: ver el detalle registra quién lo vio, sin guardar el contenido', async () => {
  const { state, db, seedConflict } = createFixture()

  seedConflict()

  const result = await getLegalConflictById('conflicto-1', access, db)

  assert.equal(result?.detailedReport, REPORT)
  assert.equal(state.audits.length, 1)

  const audit = state.audits[0]

  assert.equal(audit.userId, 'usuario-2')
  assert.equal(audit.action, 'SENSITIVE_VIEW')
  assert.equal(audit.affectedEntity, 'LegalConflict')
  assert.equal(audit.entityId, 'conflicto-1')
  assert.equal(audit.ipAddress, '10.0.0.5')
  assert.deepEqual(audit.newData, { operation: 'VIEW', conflictId: 'conflicto-1' })
  assert.equal(JSON.stringify(state.audits).includes(REPORT), false)
})

test('CRM-095: ver un conflicto que no existe devuelve null y no deja log', async () => {
  const { state, db } = createFixture()

  const result = await getLegalConflictById('conflicto-1', access, db)

  assert.equal(result, null)
  assert.equal(state.audits.length, 0)
})

test('CRM-095: si falla el log del detalle, no se entrega el informe', async () => {
  const { state, db, seedConflict } = createFixture()

  seedConflict()
  state.auditFails = true

  await assert.rejects(getLegalConflictById('conflicto-1', access, db), /Error de auditoría/)
})

test('CRM-095: listar los conflictos de un alumno registra un log del listado', async () => {
  const { state, db, seedConflict } = createFixture()

  seedConflict()

  const result = await getLegalConflictsByStudent('alumno-1', access, db)

  assert.equal(result.length, 1)
  assert.equal(result[0]?.detailedReport, REPORT)
  assert.equal(state.audits.length, 1)

  const audit = state.audits[0]

  assert.equal(audit.userId, 'usuario-2')
  assert.equal(audit.action, 'SENSITIVE_VIEW')
  assert.equal(audit.affectedEntity, 'LegalConflict')
  assert.equal(audit.ipAddress, '10.0.0.5')
  assert.deepEqual(audit.newData, { operation: 'LIST', studentId: 'alumno-1', total: 1 })
  assert.equal(JSON.stringify(state.audits).includes(REPORT), false)
})

test('CRM-095: si falla el log del listado, no se entregan los conflictos', async () => {
  const { state, db, seedConflict } = createFixture()

  seedConflict()
  state.auditFails = true

  await assert.rejects(getLegalConflictsByStudent('alumno-1', access, db), /Error de auditoría/)
})
