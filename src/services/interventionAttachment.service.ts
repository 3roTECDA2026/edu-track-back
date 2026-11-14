import { AuditActionType, type Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  readStoredAttachment,
  storeAttachments,
  type UploadedFile,
} from '@/services/attachmentStorage'
import { type Actor, assertCanEdit, getInterventionById } from '@/services/intervention.service'
import { HttpError } from '@/utils/httpError'

// Se reexporta para no romper a quien ya lo importaba desde acá
export type { UploadedFile } from '@/services/attachmentStorage'

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

  // Valida y guarda los archivos; si falla la base, storeAttachments los borra
  return storeAttachments(files, `interventions/${interventionId}`, (rows) =>
    prisma.$transaction(async (tx) => {
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
  )
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

  const content = await readStoredAttachment(attachment.storageKey)
  return { attachment, content }
}
