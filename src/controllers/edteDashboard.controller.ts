import type { Request, Response } from 'express'

import { edteDashboardQuerySchema } from '@/schemas/edteDashboard.schema'
import * as edteDashboardService from '@/services/edteDashboard.service'

// Dashboard del EDTE (CRM-077): valida los filtros y devuelve indicadores y listado juntos
export async function getEdteDashboard(req: Request, res: Response) {
  const query = edteDashboardQuerySchema.parse(req.query)
  res.json(await edteDashboardService.getEdteDashboard(query))
}
