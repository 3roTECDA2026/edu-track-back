import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createRiteSchema,
  listRitesQuerySchema,
  riteIdParamSchema,
  updateRiteNotesSchema,
} from '@/schemas/rite.schema'
import * as riteService from '@/services/rite.service'

export async function listRites(req: Request, res: Response) {
  const { studentId } = listRitesQuerySchema.parse(req.query)
  res.json(await riteService.listStudentRites(studentId))
}

export async function createRite(req: Request, res: Response) {
  const input = createRiteSchema.parse(req.body)
  res.status(201).json(await riteService.createRite(input))
}

export async function getRite(req: Request, res: Response) {
  const { id } = riteIdParamSchema.parse(req.params)
  res.json(await riteService.getRite(id))
}

export async function updateRiteNotes(req: Request, res: Response) {
  const { id } = riteIdParamSchema.parse(req.params)
  const input = updateRiteNotesSchema.parse(req.body)
  res.json(await riteService.updateRiteNotes(id, input))
}

export async function closeRite(req: Request, res: Response) {
  const { id } = riteIdParamSchema.parse(req.params)
  res.json(await riteService.closeRite(id))
}

export async function reopenRite(req: Request, res: Response) {
  const { id } = riteIdParamSchema.parse(req.params)
  res.json(await riteService.reopenRite(id))
}

export async function signRite(req: Request, res: Response) {
  const { id } = riteIdParamSchema.parse(req.params)
  // La autoridad firmante es el usuario logueado.
  const user = getAuthUser(req)
  res.json(await riteService.signRite(id, user.userId))
}