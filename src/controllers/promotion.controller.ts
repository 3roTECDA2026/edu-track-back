import type { Request, Response } from 'express'
import { getAuthUser } from '@/middlewares/auth.middleware'
import { runPromotion } from '../services/promotion.service'

export async function run(req: Request, res: Response) {
  const { academicYearId } = req.body
  const { userId: executedById } = getAuthUser(req)
  const result = await runPromotion(academicYearId, executedById)
  res.json({ success: true, decisions: result })
}
