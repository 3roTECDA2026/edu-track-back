import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  assignIntensificationsSchema,
  candidatesQuerySchema,
  intensificationIdParamSchema,
  listIntensificationsQuerySchema,
  registerResultSchema,
  updatePlacementSchema,
} from '@/schemas/intensification.schema'
import * as intensificationService from '@/services/intensification.service'

export async function listIntensifications(req: Request, res: Response) {
  const query = listIntensificationsQuerySchema.parse(req.query)
  res.json(await intensificationService.listIntensifications(query))
}

export async function listCandidates(req: Request, res: Response) {
  const query = candidatesQuerySchema.parse(req.query)
  res.json(await intensificationService.listCandidates(query))
}

export async function assignIntensifications(req: Request, res: Response) {
  const input = assignIntensificationsSchema.parse(req.body)
  res.status(201).json(await intensificationService.assignIntensifications(input))
}

export async function updatePlacement(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  const input = updatePlacementSchema.parse(req.body)
  res.json(await intensificationService.updatePlacement(id, input))
}

export async function removeIntensification(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  res.json(await intensificationService.removeIntensification(id))
}

// El usuario logueado decide si puede cargar el resultado (docente responsable o dirección)
export async function registerResult(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  const input = registerResultSchema.parse(req.body)
  const { userId, role } = getAuthUser(req)
  res.json(await intensificationService.registerResult(id, input, { userId, role }))
}