import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createSubjectRepeatSchema,
  listSubjectRepeatsQuerySchema,
  repeatOptionsQuerySchema,
  subjectRepeatIdParamSchema,
  updateSubjectRepeatSchema,
} from '@/schemas/subjectRepeat.schema'
import * as subjectRepeatService from '@/services/subjectRepeat.service'
import { sendSuccess } from '@/utils/apiResponse'

// Quién hace la acción, a partir del token (para la auditoría)
function getActor(req: Request): subjectRepeatService.Actor {
  const user = getAuthUser(req)
  return { userId: user.userId, role: user.role, ipAddress: req.ip ?? 'unknown' }
}

export async function listSubjectRepeats(req: Request, res: Response) {
  const query = listSubjectRepeatsQuerySchema.parse(req.query)
  const repeats = await subjectRepeatService.listSubjectRepeats(query)
  sendSuccess(res, repeats, 'Recursados obtenidos correctamente')
}

export async function getRepeatOptions(req: Request, res: Response) {
  const query = repeatOptionsQuerySchema.parse(req.query)
  const options = await subjectRepeatService.getRepeatOptions(query)
  sendSuccess(res, options, 'Opciones de recursado obtenidas correctamente')
}

export async function createSubjectRepeat(req: Request, res: Response) {
  const input = createSubjectRepeatSchema.parse(req.body)
  const repeat = await subjectRepeatService.assignSubjectRepeat(input, getActor(req))
  sendSuccess(res, repeat, 'Recursado asignado correctamente', 201)
}

export async function updateSubjectRepeat(req: Request, res: Response) {
  const { id } = subjectRepeatIdParamSchema.parse(req.params)
  const input = updateSubjectRepeatSchema.parse(req.body)
  const repeat = await subjectRepeatService.updateSubjectRepeat(id, input, getActor(req))
  sendSuccess(res, repeat, 'Sección del recursado actualizada correctamente')
}

export async function deleteSubjectRepeat(req: Request, res: Response) {
  const { id } = subjectRepeatIdParamSchema.parse(req.params)
  const result = await subjectRepeatService.deleteSubjectRepeat(id, getActor(req))
  sendSuccess(res, result, 'Recursado quitado correctamente')
}
