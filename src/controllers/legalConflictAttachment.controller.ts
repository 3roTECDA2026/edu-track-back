import type { Request, Response } from 'express'
import { z } from 'zod'
import { getAuthUser } from '@/middlewares/auth.middleware'
import { createLegalConflictAttachment } from '@/services/legalConflictAttachment.service'

const MAX_ATTACHMENT_LENGTH = 10000

const attachmentSchema = z
  .object({
    content: z.string().trim().min(1).max(MAX_ATTACHMENT_LENGTH),
    digitalSignHash: z.string().trim().min(1).max(255).optional(),
  })
  .strict()

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  const conflictId = z.guid().parse(req.params.id)
  const { content, digitalSignHash } = attachmentSchema.parse(req.body)
  const { userId } = getAuthUser(req)

  const attachment = await createLegalConflictAttachment({
    conflictId,
    authorId: userId,
    content,
    digitalSignHash,
    ipAddress: req.ip ?? 'unknown',
  })

  res.status(201).json({
    success: true,
    data: attachment,
  })
}
