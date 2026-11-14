import { AuditActionType, type Prisma, Role } from '@prisma/client'

import type { FileStorage } from '@/lib/storage'
import { fileStorage } from '@/lib/storage'
import { prisma } from '@/lib/prisma'
import {
  readStoredAttachment,
  storeAttachments,
  type UploadedFile,
} from '@/services/attachmentStorage'
import { HttpError } from '@/utils/httpError'

// Evidencias de un intento de intensificación (E3-RF-09, CRM-060): trabajos prácticos,
// evaluaciones. Los archivos se guardan con `fileStorage` (src/lib/storage); acá, permisos y registro.

// Quién da de baja una evidencia. Por ahora, solo dirección (decisión del 14/11/2026).
// Para sumar otro rol, se agrega acá: lo usan la ruta y el front.
export const ATTACHMENT_DELETE_ROLES: Role[] = [Role.SCHOOL_MANAGEMENT]

export interface AttachmentActor {
  userId: string
  role: Role
  ipAddress: string
}

type Db = Pick<typeof prisma, 'intensification' | 'intensificationAttachment' | '$transaction'>

// Datos de la evidencia que se devuelven (nunca la clave interna del almacenamiento).
const attachmentSelect = {
  id: true,
  intensificationId: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.IntensificationAttachmentSelect

// Solo las vigentes: las dadas de baja quedan en la tabla como registro, pero no se muestran
const ACTIVE = { deletedAt: null }

async function findAttemptOrFail(id: string, db: Db) {
  const attempt = await db.intensification.findUnique({
    where: { id },
    select: { id: true, responsibleTeacherId: true },
  })
  if (!attempt) throw new HttpError(404, 'Intento de intensificación no encontrado')
  return attempt
}

// Pueden subir los mismos que cargan el resultado (dirección, administración, preceptoría y
// docentes); el docente, solo en los intentos de los que es responsable. Se puede subir antes o
// después del resultado, también con AA: la evidencia de la evaluación suele llegar después.
export function assertCanUpload(
  attempt: { responsibleTeacherId: string | null },
  actor: Pick<AttachmentActor, 'userId' | 'role'>
) {
  if (actor.role === Role.TEACHER && attempt.responsibleTeacherId !== actor.userId) {
    throw new HttpError(
      403,
      'Solo el docente responsable o la dirección pueden adjuntar evidencias a este intento'
    )
  }
}

export async function uploadIntensificationAttachments(
  intensificationId: string,
  files: UploadedFile[],
  actor: AttachmentActor,
  db: Db = prisma,
  storage: FileStorage = fileStorage
) {
  const attempt = await findAttemptOrFail(intensificationId, db)
  assertCanUpload(attempt, actor)

  // Valida y guarda los archivos; si falla la base, storeAttachments los borra
  return storeAttachments(
    files,
    `intensifications/${intensificationId}`,
    (rows) =>
      db.$transaction(async (tx) => {
        const created = []
        for (const row of rows) {
          const attachment = await tx.intensificationAttachment.create({
            data: { ...row, intensificationId, uploadedById: actor.userId },
            select: attachmentSelect,
          })
          await tx.auditLog.create({
            data: {
              userId: actor.userId,
              action: AuditActionType.CREATE,
              affectedEntity: 'IntensificationAttachment',
              entityId: attachment.id,
              newData: JSON.parse(JSON.stringify(attachment)),
              ipAddress: actor.ipAddress,
            },
          })
          created.push(attachment)
        }
        return created
      }),
    storage
  )
}

export async function listIntensificationAttachments(intensificationId: string, db: Db = prisma) {
  await findAttemptOrFail(intensificationId, db)
  return db.intensificationAttachment.findMany({
    where: { intensificationId, ...ACTIVE },
    select: attachmentSelect,
    orderBy: { createdAt: 'asc' },
  })
}

// Se busca por los dos ids: así no se puede bajar la evidencia de otro intento usando el id de
// uno al que sí se tiene acceso. Una evidencia dada de baja responde 404.
async function findActiveAttachmentOrFail(intensificationId: string, attachmentId: string, db: Db) {
  const attachment = await db.intensificationAttachment.findFirst({
    where: { id: attachmentId, intensificationId, ...ACTIVE },
  })
  if (!attachment) throw new HttpError(404, 'Evidencia no encontrada')
  return attachment
}

export async function getIntensificationAttachmentFile(
  intensificationId: string,
  attachmentId: string,
  db: Db = prisma,
  storage: FileStorage = fileStorage
) {
  const attachment = await findActiveAttachmentOrFail(intensificationId, attachmentId, db)
  const content = await readStoredAttachment(attachment.storageKey, storage)
  return { attachment, content }
}

// Baja lógica: queda en la tabla quién la dio de baja y cuándo, y una fila en AuditLog. El
// archivo se conserva en el almacenamiento, así se puede recuperar si se borró por error.
// El rol lo controla la ruta (ATTACHMENT_DELETE_ROLES).
export async function deleteIntensificationAttachment(
  intensificationId: string,
  attachmentId: string,
  actor: AttachmentActor,
  db: Db = prisma
) {
  const attachment = await findActiveAttachmentOrFail(intensificationId, attachmentId, db)

  return db.$transaction(async (tx) => {
    // Solo si sigue vigente: si dos personas la borran a la vez, la segunda no pisa los datos
    const updated = await tx.intensificationAttachment.updateMany({
      where: { id: attachment.id, ...ACTIVE },
      data: { deletedAt: new Date(), deletedById: actor.userId },
    })
    if (updated.count === 0) throw new HttpError(404, 'Evidencia no encontrada')

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.DELETE,
        affectedEntity: 'IntensificationAttachment',
        entityId: attachment.id,
        previousData: JSON.parse(JSON.stringify(attachment)),
        ipAddress: actor.ipAddress,
      },
    })
    return { deleted: true }
  })
}
