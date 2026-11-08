import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createFortePlanReportSchema,
  createFortePlanSchema,
  fortePlanIdParamSchema,
  listFortePlansQuerySchema,
  updateFortePlanSchema,
} from '@/schemas/fortePlan.schema'
import * as fortePlanService from '@/services/fortePlan.service'

// Plan Forte (CRM-089): valida con Zod y le pasa los datos al service

export async function listFortePlans(req: Request, res: Response) {
  const query = listFortePlansQuerySchema.parse(req.query)
  res.json(await fortePlanService.listFortePlans(query))
}

export async function createFortePlan(req: Request, res: Response) {
  const input = createFortePlanSchema.parse(req.body)
  res.status(201).json(await fortePlanService.createFortePlan(input))
}

export async function updateFortePlan(req: Request, res: Response) {
  const { id } = fortePlanIdParamSchema.parse(req.params)
  const input = updateFortePlanSchema.parse(req.body)
  res.json(await fortePlanService.updateFortePlan(id, input))
}

export async function listFortePlanReports(req: Request, res: Response) {
  const { id } = fortePlanIdParamSchema.parse(req.params)
  res.json(await fortePlanService.listFortePlanReports(id))
}

export async function createFortePlanReport(req: Request, res: Response) {
  const { id } = fortePlanIdParamSchema.parse(req.params)
  const input = createFortePlanReportSchema.parse(req.body)
  const { userId, role } = getAuthUser(req)
  res.status(201).json(await fortePlanService.createFortePlanReport(id, input, { userId, role }))
}
