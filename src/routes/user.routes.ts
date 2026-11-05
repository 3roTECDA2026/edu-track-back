import { Role } from '@prisma/client'
import { Router } from 'express'

import * as userController from '@/controllers/user.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const userRouter = Router()

// Todos los endpoints de usuarios son solo para administradores
userRouter.use(verifyToken, requireRole(Role.ADMINISTRATOR))

userRouter.get('/', asyncHandler(userController.listUsers))
userRouter.post('/', asyncHandler(userController.createUser))
userRouter.get('/:id', asyncHandler(userController.getUser))
userRouter.put('/:id', asyncHandler(userController.updateUser))
userRouter.patch('/:id/suspend', asyncHandler(userController.suspendUser))
userRouter.patch('/:id/activate', asyncHandler(userController.activateUser))
