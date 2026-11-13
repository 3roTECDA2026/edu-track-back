import { randomUUID } from 'node:crypto'

import { AuditActionType, type Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { fileStorage } from '@/lib/storage'
import { type Actor, assertCanEdit, getInterventionById } from '@/services/intervention.service'
import { ALLOWED_EXTENSIONS, detectAttachmentType } from '@/utils/attachmentFileType'
import { HttpError } from '@/utils/httpError'

// Archivo tal como llega de multer (memoryStorage). Se declara acá para que el service
// no dependa de Express ni de multer.
export interface UploadedFile {
  originalname: string
  buffer: Buffer
  size: number
}

// Datos del adjunto que devolvemos (nunca la clave interna del almacenamiento).
const attachmentSelect = {
  id: true,
  interventionId: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.InterventionAttachmentSelect

const MAX_ORIGINAL_NAME_LENGTH = 255

// Datos de un archivo ya guardado en el almacenamiento, listo para registrarlo en la base.
interface SavedAttachment {
  storageKey: string
  originalName: string
  mimeType: string
  size: number
}

// Multer entrega el nombre en latin1: "evaluación.pdf" llega como "evaluaciÃ³n.pdf".
// Lo pasamos a UTF-8 para guardar el nombre con tildes y ñ.
function decodeOriginalName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8').slice(0, MAX_ORIGINAL_NAME_LENGTH)
}

// Subir uno o varios adjuntos a una intervención (CRM-087, criterios 1 y 2).
// Puede subirlos quien puede editar la intervención: el autor, dentro de las 48 hs.
export async function uploadAttachments(
  interventionId: string,
  files: UploadedFile[],
  actor: Actor
) {
  // 404/403 si no existe o el usuario no tiene acceso (misma regla que el detalle)
  const intervention = await getInterventionById(interventionId, actor)
  assertCanEdit(intervention, actor)

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

  // Guardar los archivos. El nombre en el almacenamiento es un UUID: nunca el nombre original,
  // que puede repetirse o traer caracteres raros.
  const savedKeys: string[] = []
  try {
    const rows: SavedAttachment[] = []
    for (const { file, originalName, type } of prepared) {
      if (!type) continue // ya validado arriba; esto es para TypeScript
      const storageKey = `interventions/${interventionId}/${randomUUID()}${type.extension}`
      await fileStorage.save(storageKey, file.buffer)
      savedKeys.push(storageKey)
      rows.push({ storageKey, originalName, mimeType: type.mimeType, size: file.size })
    }

    return await prisma.$transaction(async (tx) => {
      const created = []
      for (const row of rows) {
        const attachment = await tx.interventionAttachment.create({
          data: { ...row, interventionId, uploadedById: actor.userId },
          select: attachmentSelect,
        })
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            action: AuditActionType.CREATE,
            affectedEntity: 'InterventionAttachment',
            entityId: attachment.id,
            newData: JSON.parse(JSON.stringify(attachment)),
            ipAddress: actor.ipAddress,
          },
        })
        created.push(attachment)
      }
      return created
    })
  } catch (error) {
    // Si falla la base (o un archivo a mitad de camino), borrar los archivos ya guardados
    // para no dejar archivos huérfanos sin registro.
    await Promise.allSettled(savedKeys.map((key) => fileStorage.remove(key)))
    throw error
  }
}

// Listar los adjuntos de una intervención (CRM-087, criterio 5).
export async function listAttachments(interventionId: string, actor: Actor) {
  await getInterventionById(interventionId, actor)
  return prisma.interventionAttachment.findMany({
    where: { interventionId },
    select: attachmentSelect,
    orderBy: { createdAt: 'asc' },
  })
}

// Descargar un adjunto (CRM-087, criterio 3): solo con token y acceso a la intervención.
export async function getAttachmentFile(
  interventionId: string,
  attachmentId: string,
  actor: Actor
) {
  await getInterventionById(interventionId, actor)

  // Se busca por los dos ids: así no se puede bajar el adjunto de otra intervención
  // usando el id de una intervención a la que sí se tiene acceso.
  const attachment = await prisma.interventionAttachment.findFirst({
    where: { id: attachmentId, interventionId },
  })
  if (!attachment) {
    throw new HttpError(404, 'Adjunto no encontrado')
  }

  const content = await fileStorage.read(attachment.storageKey)
  if (!content) {
    throw new HttpError(404, 'El archivo ya no está disponible en el servidor')
  }

  return { attachment, content }
}
