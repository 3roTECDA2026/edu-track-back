import type { Request, Response } from 'express'
import { z } from 'zod'
import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  startTotpEnrollment,
  confirmTotpEnrollment,
} from '@/services/conflictTotp.service'

const confirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
}).strict()

// Iniciar la vinculación del autenticador
export const startEnrollment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = getAuthUser(req)

  const result = await startTotpEnrollment(userId)

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    success: true,
    data: result,
  })
}

// Confirmar la vinculación con un código TOTP
export const confirmEnrollment = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = getAuthUser(req)
  const { code } = confirmSchema.parse(req.body)

  const result = await confirmTotpEnrollment(userId, code)

  res.status(200).json({
    success: true,
    data: result,
  })
}
