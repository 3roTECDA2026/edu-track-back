import { Role } from '@prisma/client'
import { Router } from 'express'

import * as riteController from '@/controllers/rite.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const riteRouter = Router()

// Cerrar, reabrir y firmar el RITE es tarea de la dirección o del EOE.
const directiveRoles = requireRole(Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE, Role.ADMINISTRATOR)

// Las consultas también exigen sesión: el RITE tiene datos personales del alumno
riteRouter.get('/', verifyToken, asyncHandler(riteController.listRites))
riteRouter.get('/:id', verifyToken, asyncHandler(riteController.getRite))

// Crear y editar observaciones requiere un usuario logueado.
riteRouter.post('/', verifyToken, asyncHandler(riteController.createRite))
riteRouter.patch('/:id', verifyToken, asyncHandler(riteController.updateRiteNotes))

riteRouter.patch('/:id/close', verifyToken, directiveRoles, asyncHandler(riteController.closeRite))
riteRouter.patch('/:id/reopen', verifyToken, directiveRoles, asyncHandler(riteController.reopenRite))
riteRouter.patch('/:id/sign', verifyToken, directiveRoles, asyncHandler(riteController.signRite))