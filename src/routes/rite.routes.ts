import { Role } from '@prisma/client'
import { Router } from 'express'

import * as riteController from '@/controllers/rite.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const riteRouter = Router()

riteRouter.get('/', asyncHandler(riteController.listRites))
riteRouter.post('/', asyncHandler(riteController.createRite))
riteRouter.get('/:id', asyncHandler(riteController.getRite))
riteRouter.patch('/:id', asyncHandler(riteController.updateRiteNotes))
riteRouter.patch('/:id/close', asyncHandler(riteController.closeRite))
riteRouter.patch('/:id/reopen', asyncHandler(riteController.reopenRite))

// Solo la dirección o el EOE firman, y la autoridad firmante es el usuario logueado.
riteRouter.patch(
  '/:id/sign',
  verifyToken,
  requireRole(Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE, Role.ADMINISTRATOR),
  asyncHandler(riteController.signRite)
)