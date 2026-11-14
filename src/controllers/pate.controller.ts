import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  changePateStatusSchema,
  createPateSchema,
  listPatesQuerySchema,
  pateIdParamSchema,
  pateOptionsQuerySchema,
  updatePateSchema,
} from '@/schemas/pate.schema'
import * as pateService from '@/services/pate.service'

// PATE (CRM-078): valida con Zod y le pasa los datos al service

// Quién hace el cambio: sale del token, nunca del body (y la IP, para la auditoría)
function getActor(req: Request) {
  return { userId: getAuthUser(req).userId, ipAddress: req.ip ?? 'unknown' }
}

export async function listPates(req: Request, res: Response) {
  const query = listPatesQuerySchema.parse(req.query)
  const { userId, role } = getAuthUser(req)
  res.json(await pateService.listPates(query, { userId, role }))
}

export async function getPateOptions(req: Request, res: Response) {
  const query = pateOptionsQuerySchema.parse(req.query)
  res.json(await pateService.getPateOptions(query))
}

export async function getPate(req: Request, res: Response) {
  const { id } = pateIdParamSchema.parse(req.params)
  const { userId, role } = getAuthUser(req)
  res.json(await pateService.getPateForViewer(id, { userId, role }))
}

export async function getPatePdf(req: Request, res: Response) {
  const { id } = pateIdParamSchema.parse(req.params)
  const buffer = await pateService.generatePatePdf(id)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="pate-${id}.pdf"`)
  res.send(buffer)
}

export async function createPate(req: Request, res: Response) {
  const input = createPateSchema.parse(req.body)
  res.status(201).json(await pateService.createPate(input, getActor(req)))
}

export async function updatePate(req: Request, res: Response) {
  const { id } = pateIdParamSchema.parse(req.params)
  const input = updatePateSchema.parse(req.body)
  res.json(await pateService.updatePate(id, input, getActor(req)))
}

export async function changePateStatus(req: Request, res: Response) {
  const { id } = pateIdParamSchema.parse(req.params)
  const { status } = changePateStatusSchema.parse(req.body)
  res.json(await pateService.changePateStatus(id, status, getActor(req)))
}
