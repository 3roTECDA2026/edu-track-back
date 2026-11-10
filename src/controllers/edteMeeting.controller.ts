import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createEdteMeetingSchema,
  edteMeetingCandidatesQuerySchema,
  edteMeetingIdParamSchema,
  listEdteMeetingsQuerySchema,
  updateEdteMeetingSchema,
} from '@/schemas/edteMeeting.schema'
import * as edteMeetingService from '@/services/edteMeeting.service'

// Reuniones del EDTE (CRM-075): valida con Zod y le pasa los datos al service

// Quién hace el cambio: sale del token, nunca del body (y la IP, para la auditoría)
function getActor(req: Request) {
  return { userId: getAuthUser(req).userId, ipAddress: req.ip ?? 'unknown' }
}

export async function listEdteMeetings(req: Request, res: Response) {
  const query = listEdteMeetingsQuerySchema.parse(req.query)
  res.json(await edteMeetingService.listEdteMeetings(query))
}

export async function getEdteMeetingCandidates(req: Request, res: Response) {
  const query = edteMeetingCandidatesQuerySchema.parse(req.query)
  res.json(await edteMeetingService.getEdteMeetingCandidates(query))
}

export async function getEdteMeeting(req: Request, res: Response) {
  const { id } = edteMeetingIdParamSchema.parse(req.params)
  res.json(await edteMeetingService.getEdteMeeting(id))
}

export async function createEdteMeeting(req: Request, res: Response) {
  const input = createEdteMeetingSchema.parse(req.body)
  res.status(201).json(await edteMeetingService.createEdteMeeting(input, getActor(req)))
}

export async function updateEdteMeeting(req: Request, res: Response) {
  const { id } = edteMeetingIdParamSchema.parse(req.params)
  const input = updateEdteMeetingSchema.parse(req.body)
  res.json(await edteMeetingService.updateEdteMeeting(id, input, getActor(req)))
}

export async function signEdteMeeting(req: Request, res: Response) {
  const { id } = edteMeetingIdParamSchema.parse(req.params)
  res.json(await edteMeetingService.signEdteMeeting(id, getActor(req)))
}
