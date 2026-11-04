import type { Request, Response } from 'express'
import { runPromotion } from '../services/promotion.service'

export async function run(req: Request, res: Response) {
  const { academicYearId } = req.body
  const executedById = (req as any).user?.id ?? req.body.executedById
  const result = await runPromotion(academicYearId, executedById)
  res.json({ success: true, decisions: result })
}
