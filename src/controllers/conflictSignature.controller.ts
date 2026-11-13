import type { Request, Response } from 'express'
import { z } from 'zod'
import { getAuthUser } from '@/middlewares/auth.middleware'
import { signLegalConflict } from '@/services/conflictSignature.service'

const signSchema = z
  .object({
    totpCode: z.string().regex(/^\d{6}$/, 'El código debe contener exactamente 6 dígitos'),
    accepted: z.literal(true),
  })
  .strict()

export const sign = async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuthUser(req)
  const { totpCode, accepted } = signSchema.parse(req.body)

  const conflictId = z.guid().parse(req.params.id)

  const result = await signLegalConflict({
    conflictId,
    signerId: userId,
    totpCode,
    accepted,
    ipAddress: req.ip ?? 'unknown',
  })

  res.setHeader('Cache-Control', 'no-store')

  res.status(200).json({
    success: true,
    message: 'Acta firmada electrónicamente',
    data: result,
  })
}
