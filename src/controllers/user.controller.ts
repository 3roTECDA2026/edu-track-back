import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from '@/schemas/user.schema'
import * as userService from '@/services/user.service'
import { sendSuccess } from '@/utils/apiResponse'

export async function listUsers(req: Request, res: Response) {
  const query = listUsersQuerySchema.parse(req.query)
  sendSuccess(res, await userService.listUsers(query), 'Usuarios obtenidos correctamente')
}

export async function getUser(req: Request, res: Response) {
  const { id } = userIdParamSchema.parse(req.params)
  sendSuccess(res, await userService.getUser(id), 'Usuario obtenido correctamente')
}

export async function createUser(req: Request, res: Response) {
  const data = createUserSchema.parse(req.body)
  sendSuccess(res, await userService.createUser(data), 'Usuario creado correctamente', 201)
}

export async function updateUser(req: Request, res: Response) {
  const { id } = userIdParamSchema.parse(req.params)
  const data = updateUserSchema.parse(req.body)
  sendSuccess(res, await userService.updateUser(id, data), 'Usuario actualizado correctamente')
}

export async function suspendUser(req: Request, res: Response) {
  const { id } = userIdParamSchema.parse(req.params)
  const { userId } = getAuthUser(req)
  sendSuccess(res, await userService.suspendUser(id, userId), 'Usuario suspendido correctamente')
}

export async function activateUser(req: Request, res: Response) {
  const { id } = userIdParamSchema.parse(req.params)
  sendSuccess(res, await userService.activateUser(id), 'Usuario activado correctamente')
}
