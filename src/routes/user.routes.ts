
import { Role } from '@prisma/client'
import { Router } from 'express'

import * as userController from '@/controllers/user.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const userRouter = Router()

// Solo administradores pueden gestionar usuarios
userRouter.use(
  verifyToken,
  requireRole(Role.ADMINISTRATOR)
)

// GET /api/users
// Listar usuarios
userRouter.get(
  '/',
  asyncHandler(userController.listUsers)
)

// POST /api/users
// Crear usuario
userRouter.post(
  '/',
  asyncHandler(userController.createUser)
)

// GET /api/users/:id
// Obtener usuario
userRouter.get(
  '/:id',
  asyncHandler(userController.getUser)
)

// PUT /api/users/:id
// Actualizar usuario
userRouter.put(
  '/:id',
  asyncHandler(userController.updateUser)
)

// PATCH /api/users/:id/suspend
// Suspender usuario
userRouter.patch(
  '/:id/suspend',
  asyncHandler(userController.suspendUser)
)

// PATCH /api/users/:id/activate
// Reactivar usuario
userRouter.patch(
  '/:id/activate',
  asyncHandler(userController.activateUser)
)
