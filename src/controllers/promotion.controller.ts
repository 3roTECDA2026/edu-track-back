import type { Request, Response } from 'express'
import { z } from 'zod'
import { getAuthUser } from '@/middlewares/auth.middleware'
import { runPromotion } from '@/services/promotion.service'

const runPromotionSchema = z.object({
  academicYearId: z.string().min(1, 'El ID del ciclo lectivo es requerido'),
})

export async function run(req: Request, res: Response) {
  const { academicYearId } = runPromotionSchema.parse(req.body)
  const { userId: executedById } = getAuthUser(req)
  const result = await runPromotion(academicYearId, executedById)
  res.json({ success: true, decisions: result })
}

