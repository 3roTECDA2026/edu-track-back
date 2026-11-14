import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AuditActionType, Role } from '@prisma/client'

import type { FileStorage } from '@/lib/storage'
import { HttpError } from '@/utils/httpError'

import {
  ATTACHMENT_DELETE_ROLES,
  deleteIntensificationAttachment,
  getIntensificationAttachmentFile,
  listIntensificationAttachments,
  uploadIntensificationAttachments,
} from './intensificationAttachment.service'

type Db = NonNullable<Parameters<typeof uploadIntensificationAttachments>[3]>

const RESPONSIBLE = 'docente-responsable'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const png = { originalname: 'tp.png', buffer: PNG, size: PNG.length }

// Evidencia vigente del intento i1
const stored = {
  id: 'a1',
  intensificationId: 'i1',
  storageKey: 'intensifications/i1/a1.png',
  originalName: 'tp.png',
  mimeType: 'image/png',
  size: PNG.length,
  deletedAt: null,
}

// Base falsa: un intento i1 con su docente responsable y la evidencia a1.
// Anota lo que se crea, se actualiza y se audita.
const fakeDb = () => {
  const created: unknown[] = []
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = []
  const audits: Array<{ action: AuditActionType }> = []
  const listQueries: unknown[] = []
  const attachments = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: `nuevo-${created.length}`, ...data }
    },
    findFirst: async ({ where }: { where: { id: string; intensificationId: string } }) =>
      where.id === stored.id && where.intensificationId === stored.intensificationId
        ? stored
        : null,
    findMany: async (args: unknown) => {
      listQueries.push(args)
      return [stored]
    },
    updateMany: async (args: { where: unknown; data: Record<string, unknown> }) => {
      updates.push(args)
      return { count: 1 }
    },
  }
  const auditLog = {
    create: async ({ data }: { data: { action: AuditActionType } }) => {
      audits.push(data)
      return data
    },
  }
  const db = {
    intensification: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === 'i1' ? { id: 'i1', responsibleTeacherId: RESPONSIBLE } : null,
    },
    intensificationAttachment: attachments,
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ intensificationAttachment: attachments, auditLog }),
  } as unknown as Db
  return { db, created, updates, audits, listQueries }
}

const fakeStorage = () => {
  const saved: string[] = []
  const storage: FileStorage = {
    save: async (key) => {
      saved.push(key)
    },
    read: async (key) => (key === stored.storageKey ? PNG : null),
    remove: async () => {},
  }
  return { storage, saved }
}

const actor = (userId: string, role: Role) => ({ userId, role, ipAddress: '127.0.0.1' })
const isStatus = (status: number) => (err: unknown) =>
  err instanceof HttpError && err.status === status

describe('subir evidencias a un intento de intensificación (CRM-060)', () => {
  it('404 si el intento no existe', async () => {
    const { db } = fakeDb()
    const { storage } = fakeStorage()
    await assert.rejects(
      uploadIntensificationAttachments(
        'otro',
        [png],
        actor('x', Role.SCHOOL_MANAGEMENT),
        db,
        storage
      ),
      isStatus(404)
    )
  })

  it('un docente que no es el responsable recibe 403 y no se guarda nada', async () => {
    const { db, created } = fakeDb()
    const { storage, saved } = fakeStorage()
    await assert.rejects(
      uploadIntensificationAttachments(
        'i1',
        [png],
        actor('otro-docente', Role.TEACHER),
        db,
        storage
      ),
      isStatus(403)
    )
    assert.equal(saved.length, 0)
    assert.equal(created.length, 0)
  })

  it('el docente responsable sube, queda registrado quién lo subió y se audita', async () => {
    const { db, created, audits } = fakeDb()
    const { storage, saved } = fakeStorage()
    const result = await uploadIntensificationAttachments(
      'i1',
      [png],
      actor(RESPONSIBLE, Role.TEACHER),
      db,
      storage
    )
    assert.equal(result.length, 1)
    assert.equal(saved.length, 1)
    assert.match(saved[0]!, /^intensifications\/i1\//)
    assert.equal((created[0] as { uploadedById: string }).uploadedById, RESPONSIBLE)
    assert.equal(audits[0]?.action, AuditActionType.CREATE)
  })

  it('preceptoría y dirección pueden subir aunque no sean el docente responsable', async () => {
    for (const role of [Role.PRECEPTOR, Role.SCHOOL_MANAGEMENT]) {
      const { db } = fakeDb()
      const { storage } = fakeStorage()
      const result = await uploadIntensificationAttachments(
        'i1',
        [png],
        actor('alguien', role),
        db,
        storage
      )
      assert.equal(result.length, 1)
    }
  })
})

describe('descargar y dar de baja una evidencia (CRM-060)', () => {
  it('no se puede bajar la evidencia de otro intento usando un id ajeno', async () => {
    const { db } = fakeDb()
    const { storage } = fakeStorage()
    await assert.rejects(getIntensificationAttachmentFile('i2', 'a1', db, storage), isStatus(404))
    const { content } = await getIntensificationAttachmentFile('i1', 'a1', db, storage)
    assert.deepEqual(content, PNG)
  })

  it('la baja es lógica: guarda quién y cuándo, y deja registro en AuditLog', async () => {
    const { db, updates, audits } = fakeDb()
    await deleteIntensificationAttachment(
      'i1',
      'a1',
      actor('directora', Role.SCHOOL_MANAGEMENT),
      db
    )
    assert.equal(updates.length, 1)
    assert.equal(updates[0]!.data.deletedById, 'directora')
    assert.ok(updates[0]!.data.deletedAt instanceof Date)
    assert.equal(audits[0]?.action, AuditActionType.DELETE)
  })

  it('404 si la evidencia no es de ese intento', async () => {
    const { db, updates } = fakeDb()
    await assert.rejects(
      deleteIntensificationAttachment('i1', 'otra', actor('directora', Role.SCHOOL_MANAGEMENT), db),
      isStatus(404)
    )
    assert.equal(updates.length, 0)
  })
})

describe('listado y permisos de baja (CRM-060)', () => {
  it('el listado pide solo las evidencias vigentes (no las dadas de baja)', async () => {
    const { db, listQueries } = fakeDb()
    await listIntensificationAttachments('i1', db)
    const where = (listQueries[0] as { where: Record<string, unknown> }).where
    assert.equal(where.intensificationId, 'i1')
    assert.equal(where.deletedAt, null)
  })

  it('por ahora solo dirección puede dar de baja (lo usa la ruta)', () => {
    assert.deepEqual(ATTACHMENT_DELETE_ROLES, [Role.SCHOOL_MANAGEMENT])
  })
})
