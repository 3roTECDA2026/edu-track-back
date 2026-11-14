import type { Request, Response } from 'express'

import { listEdteReferralsQuerySchema } from '@/schemas/edteReferral.schema'
import * as edteReferralService from '@/services/edteReferral.service'

// Listado de derivación al EDTE (CRM-073): valida los filtros con Zod y consulta el service
export async function listEdteReferrals(req: Request, res: Response) {
  const query = listEdteReferralsQuerySchema.parse(req.query)
  res.json(await edteReferralService.listEdteReferrals(query))
}
