import { randomUUID } from 'node:crypto'

import { type FileStorage, fileStorage } from '@/lib/storage'
import { ALLOWED_EXTENSIONS, detectAttachmentType } from '@/utils/attachmentFileType'
import { HttpError } from '@/utils/httpError'

// Parte común de los adjuntos (intervenciones, CRM-087; evidencias de intensificación, CRM-060):
// validar los archivos, guardarlos en el almacenamiento y leerlos. Cada service decide los
// permisos y en qué tabla registra los archivos.

// Archivo tal como llega de multer (memoryStorage). Se declara acá para que los services
// no dependan de Express ni de multer.
export interface UploadedFile {
  originalname: string
  buffer: Buffer
  size: number
}

// Datos de un archivo ya guardado en el almacenamiento, listo para registrarlo en la base.
export interface StoredAttachment {
  storageKey: string
  originalName: string
  mimeType: string
  size: number
}

const MAX_ORIGINAL_NAME_LENGTH = 255

// Multer entrega el nombre en latin1: "evaluación.pdf" llega como "evaluaciÃ³n.pdf".
// Lo pasamos a UTF-8 para guardar el nombre con tildes y ñ.
export function decodeOriginalName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8').slice(0, MAX_ORIGINAL_NAME_LENGTH)
}

// Valida todos los archivos y los guarda con un nombre UUID bajo `keyPrefix`
// (ej. "interventions/<id>"). Después llama a `persist` para registrarlos en la base.
// Si algo falla, borra los archivos ya guardados: no quedan archivos sin registro.
export async function storeAttachments<T>(
  files: UploadedFile[],
  keyPrefix: string,
  persist: (rows: StoredAttachment[]) => Promise<T>,
  storage: FileStorage = fileStorage
): Promise<T> {
  if (files.length === 0) {
    throw new HttpError(400, 'Hay que adjuntar al menos un archivo')
  }

  // Validar todos antes de guardar ninguno, y devolver todos los errores juntos.
  const errors: string[] = []
  const prepared = files.map((file) => {
    const originalName = decodeOriginalName(file.originalname)
    const type = detectAttachmentType(originalName, file.buffer)
    if (!type) {
      errors.push(
        `"${originalName}": tipo de archivo no permitido o dañado (se aceptan ${ALLOWED_EXTENSIONS.join(', ')})`
      )
    }
    return { file, originalName, type }
  })
  if (errors.length > 0) {
    throw new HttpError(400, 'Hay archivos que no se pueden adjuntar', { errors })
  }

  // El nombre en el almacenamiento es un UUID: nunca el nombre original, que puede repetirse
  // o traer caracteres raros.
  const savedKeys: string[] = []
  try {
    const rows: StoredAttachment[] = []
    for (const { file, originalName, type } of prepared) {
      if (!type) continue // ya validado arriba; esto es para TypeScript
      const storageKey = `${keyPrefix}/${randomUUID()}${type.extension}`
      await storage.save(storageKey, file.buffer)
      savedKeys.push(storageKey)
      rows.push({ storageKey, originalName, mimeType: type.mimeType, size: file.size })
    }
    return await persist(rows)
  } catch (error) {
    await Promise.allSettled(savedKeys.map((key) => storage.remove(key)))
    throw error
  }
}

// Lee el archivo de un adjunto. 404 si el registro existe pero el archivo ya no está.
export async function readStoredAttachment(
  storageKey: string,
  storage: FileStorage = fileStorage
): Promise<Buffer> {
  const content = await storage.read(storageKey)
  if (!content) {
    throw new HttpError(404, 'El archivo ya no está disponible en el servidor')
  }
  return content
}
