import { Role } from '@prisma/client'
import { Router } from 'express'

import * as pateController from '@/controllers/pate.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const pateRouter = Router()

// Ver los PATE: personal de la escuela (el docente acompaña la trayectoria)
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Crear, editar, confirmar y cerrar: dirección, EOE/directivos y administración (el EDTE)
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

pateRouter.use(verifyToken)

pateRouter.get('/', canView, asyncHandler(pateController.listPates))
// Antes de "/:id", para que "options" no se tome como un id
pateRouter.get('/options', canManage, asyncHandler(pateController.getPateOptions))
pateRouter.get('/:id', canView, asyncHandler(pateController.getPate))
pateRouter.get('/:id/pdf', canView, asyncHandler(pateController.getPatePdf))
pateRouter.post('/', canManage, asyncHandler(pateController.createPate))
pateRouter.patch('/:id', canManage, asyncHandler(pateController.updatePate))
pateRouter.patch('/:id/status', canManage, asyncHandler(pateController.changePateStatus))
