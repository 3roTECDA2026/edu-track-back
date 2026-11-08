import { Role } from '@prisma/client'
import { Router } from 'express'

import * as fortePlanController from '@/controllers/fortePlan.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const fortePlanRouter = Router()

// Ver los planes y sus reportes: personal de la escuela
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER
)

// Asignar alumnos y cambiar el plan: dirección, EOE/directivos y administración
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

fortePlanRouter.use(verifyToken)

fortePlanRouter.get('/', canView, asyncHandler(fortePlanController.listFortePlans))
fortePlanRouter.post('/', canManage, asyncHandler(fortePlanController.createFortePlan))
fortePlanRouter.patch('/:id', canManage, asyncHandler(fortePlanController.updateFortePlan))
fortePlanRouter.get('/:id/reports', canView, asyncHandler(fortePlanController.listFortePlanReports))
// Cargar reportes: además de la dirección, el docente responsable del plan (lo controla el service)
fortePlanRouter.post(
  '/:id/reports',
  canView,
  asyncHandler(fortePlanController.createFortePlanReport)
)
