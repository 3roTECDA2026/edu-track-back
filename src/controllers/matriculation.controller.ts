import type { Request, Response } from 'express'
import { continueMatriculation } from '../services/matriculation.service'

export async function run(req: Request, res: Response) {
  const { fromYearId, toYearId } = req.body
  const result = await continueMatriculation(fromYearId, toYearId)
  res.json({ success: true, ...result })
}
