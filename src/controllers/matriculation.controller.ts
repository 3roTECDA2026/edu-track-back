import type { Request, Response } from 'express'
import { continueMatriculationSchema } from '@/schemas/matriculation.schema'
import { continueMatriculation } from '@/services/matriculation.service'

export async function run(req: Request, res: Response) {
  const { fromYearId, toYearId } = continueMatriculationSchema.parse(req.body)
  const result = await continueMatriculation(fromYearId, toYearId)
  res.json({ success: true, ...result })
}
