import { randomUUID } from 'node:crypto'

import { prisma } from '@/lib/prisma'
import { calculateAttachmentHash } from '@/utils/conflictDocumentHash'
import { HttpError } from '@/utils/httpError'
import { encryptConflictReport, decryptConflictReport } from '@/utils/conflictEncryption'

interface CreateAttachmentData {
  conflictId: string
  authorId: string
  content: string
  ipAddress: string
}

type AttachmentDatabase = Pick<typeof prisma, '$transaction'>

export const createAttachmentService = (db: AttachmentDatabase) => {
  return async (data: CreateAttachmentData) => {
    return db.$transaction(async (tx) => {
      const conflict = await tx.legalConflict.findUnique({
        where: { id: data.conflictId },
        select: { id: true },
      })

      if (!conflict) {
        throw new HttpError(404, 'Conflicto legal no encontrado')
      }

      // CRM-093: UUID, fecha y hash de integridad del anexo, calculados antes de guardar
      const documentUuid = randomUUID()
      const date = new Date()
      const digitalSignHash = calculateAttachmentHash({
        documentUuid,
        conflictId: data.conflictId,
        authorId: data.authorId,
        content: data.content,
        date,
      })

      const attachment = await tx.legalConflictAttachment.create({
        data: {
          documentUuid,
          date,
          conflictId: data.conflictId,
          authorId: data.authorId,
          content: encryptConflictReport(data.content),
          digitalSignHash,
        },
      })

      // El hash va también al AuditLog, que no se puede modificar (copia para la verificación).
      // "signed" sigue siendo la firma electrónica (TOTP), que los anexos no tienen.
      await tx.auditLog.create({
        data: {
          userId: data.authorId,
          action: 'CREATE',
          affectedEntity: 'LegalConflictAttachment',
          entityId: attachment.id,
          ipAddress: data.ipAddress,
          newData: {
            conflictId: data.conflictId,
            attachmentId: attachment.id,
            authorId: data.authorId,
            signed: false,
            documentUuid,
            digitalSignHash,
          },
        },
      })

      return {
        ...attachment,
        content: decryptConflictReport(attachment.content),
      }
    })
  }
}

export const createLegalConflictAttachment = createAttachmentService(prisma)
