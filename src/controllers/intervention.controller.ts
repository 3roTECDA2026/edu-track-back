import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createInterventionSchema,
  interventionIdParamSchema,
  listInterventionsQuerySchema,
  updateInterventionSchema,
} from '@/schemas/intervention.schema'
import * as interventionService from '@/services/intervention.service'
import { sendSuccess } from '@/utils/apiResponse'

// Arma el "actor" (quién hace la acción) a partir del token y la request.
function getActor(req: Request) {
  const user = getAuthUser(req)
  return { userId: user.userId, role: user.role, ipAddress: req.ip ?? 'unknown' }
}

export async function createIntervention(req: Request, res: Response) {
  const data = createInterventionSchema.parse(req.body)
  const intervention = await interventionService.createIntervention(data, getActor(req))
  sendSuccess(res, intervention, 'Intervención registrada correctamente', 201)
}

export async function listInterventions(req: Request, res: Response) {
  const query = listInterventionsQuerySchema.parse(req.query)
  const result = await interventionService.listInterventions(query, getActor(req))
  sendSuccess(res, result, 'Intervenciones obtenidas correctamente')
}

export async function getInterventionById(req: Request, res: Response) {
  const { id } = interventionIdParamSchema.parse(req.params)
  const intervention = await interventionService.getInterventionById(id, getActor(req))
  sendSuccess(res, intervention, 'Intervención obtenida correctamente')
}

export async function updateIntervention(req: Request, res: Response) {
  const { id } = interventionIdParamSchema.parse(req.params)
  const data = updateInterventionSchema.parse(req.body)
  const intervention = await interventionService.updateIntervention(id, data, getActor(req))
  sendSuccess(res, intervention, 'Intervención actualizada correctamente')
}