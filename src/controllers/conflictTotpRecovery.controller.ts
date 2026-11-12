import type { Request, Response } from 'express'
import { z } from 'zod'
import { getAuthUser } from '@/middlewares/auth.middleware'
import { requestTotpRecovery, approveTotpRecovery } from '@/services/conflictTotpRecovery.service'

const requestSchema = z
  .object({
    reason: z.string().trim().min(10).max(1000),
  })
  .strict()

const approveSchema = z
  .object({
    recoveryId: z.guid(),
    password: z.string().min(1),
    identityVerified: z.literal(true),
    verificationMethod: z.literal('IN_PERSON'),
  })
  .strict()

// El usuario solicita recuperar su propio autenticador.
export const requestRecovery = async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuthUser(req)
  const { reason } = requestSchema.parse(req.body)

  const result = await requestTotpRecovery({
    userId,
    reason,
    ipAddress: req.ip ?? 'unknown',
  })

  res.setHeader('Cache-Control', 'no-store')
  res.status(201).json({
    success: true,
    data: result,
  })
}

// Un directivo diferente autoriza la recuperación.
export const approveRecovery = async (req: Request, res: Response): Promise<void> => {
  const { userId: approverId } = getAuthUser(req)

  const { recoveryId, password, identityVerified, verificationMethod } = approveSchema.parse(
    req.body
  )

  const result = await approveTotpRecovery({
    recoveryId,
    approverId,
    password,
    identityVerified,
    verificationMethod,
    ipAddress: req.ip ?? 'unknown',
  })

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    success: true,
    data: result,
  })
}
