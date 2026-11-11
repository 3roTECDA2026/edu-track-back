import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import {
  encryptConflictReport,
  decryptConflictReport,
} from '@/utils/conflictEncryption'

interface CreateAttachmentData {
  conflictId: string
  authorId: string
  content: string
  ipAddress: string
  digitalSignHash?: string
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

      const attachment = await tx.legalConflictAttachment.create({
        data: {
          conflictId: data.conflictId,
          authorId: data.authorId,
          content: encryptConflictReport(data.content),
          digitalSignHash: data.digitalSignHash ?? null,
        },
      })

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
            signed: Boolean(attachment.digitalSignHash),
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
