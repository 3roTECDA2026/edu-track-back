import type { Request, Response } from 'express'
import { getAuthUser } from '@/middlewares/auth.middleware'
import { runPromotionSchema } from '@/schemas/promotion.schema'
import { runPromotion } from '@/services/promotion.service'

export async function run(req: Request, res: Response) {
  const { academicYearId } = runPromotionSchema.parse(req.body)
  const { userId: executedById } = getAuthUser(req)
  // La IP va a la auditoría de las derivaciones al EDTE (CRM-073)
  const result = await runPromotion(academicYearId, executedById, req.ip ?? 'unknown')
  res.json({ success: true, decisions: result })
}
