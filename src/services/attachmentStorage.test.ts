import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { FileStorage } from '@/lib/storage'
import { HttpError } from '@/utils/httpError'

import { readStoredAttachment, storeAttachments, type UploadedFile } from './attachmentStorage'

// Almacenamiento falso en memoria: anota lo que se guarda y lo que se borra
const fakeStorage = () => {
  const files = new Map<string, Buffer>()
  const removed: string[] = []
  const storage: FileStorage = {
    save: async (key, data) => {
      files.set(key, data)
    },
    read: async (key) => files.get(key) ?? null,
    remove: async (key) => {
      removed.push(key)
      files.delete(key)
    },
  }
  return { storage, files, removed }
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const PDF = Buffer.from('%PDF-1.7 ...')
const file = (originalname: string, buffer: Buffer): UploadedFile => ({
  originalname,
  buffer,
  size: buffer.length,
})

const isStatus = (status: number) => (err: unknown) =>
  err instanceof HttpError && err.status === status

describe('guardar adjuntos (CRM-087 y CRM-060)', () => {
  it('400 si no viene ningún archivo', async () => {
    const { storage } = fakeStorage()
    await assert.rejects(
      storeAttachments([], 'x', async () => [], storage),
      isStatus(400)
    )
  })

  it('si un archivo no es válido, devuelve todos los errores y no guarda ninguno', async () => {
    const { storage, files } = fakeStorage()
    await assert.rejects(
      storeAttachments(
        [file('foto.png', PNG), file('falso.pdf', Buffer.from('hola'))],
        'x',
        async () => [],
        storage
      ),
      (err: unknown) =>
        err instanceof HttpError &&
        err.status === 400 &&
        (err.details as { errors: string[] }).errors.length === 1
    )
    assert.equal(files.size, 0)
  })

  it('guarda con nombre UUID bajo el prefijo y pasa los datos para registrarlos', async () => {
    const { storage, files } = fakeStorage()
    // multer entrega el nombre en latin1: "evaluación" llega mal codificado
    const latin1Name = Buffer.from('evaluación.pdf', 'utf8').toString('latin1')
    const rows = await storeAttachments(
      [file(latin1Name, PDF)],
      'intensifications/i1',
      async (stored) => stored,
      storage
    )
    assert.equal(rows.length, 1)
    assert.match(rows[0]!.storageKey, /^intensifications\/i1\/[0-9a-f-]{36}\.pdf$/)
    assert.equal(rows[0]!.originalName, 'evaluación.pdf')
    assert.equal(rows[0]!.mimeType, 'application/pdf')
    assert.equal(files.size, 1)
  })

  it('si falla el registro en la base, borra los archivos ya guardados', async () => {
    const { storage, files, removed } = fakeStorage()
    await assert.rejects(
      storeAttachments(
        [file('a.png', PNG), file('b.pdf', PDF)],
        'x',
        async () => {
          throw new Error('falló la base')
        },
        storage
      ),
      { message: 'falló la base' }
    )
    assert.equal(removed.length, 2)
    assert.equal(files.size, 0)
  })

  it('404 si el archivo ya no está en el almacenamiento', async () => {
    const { storage } = fakeStorage()
    await assert.rejects(readStoredAttachment('no/existe.pdf', storage), isStatus(404))
  })
})
