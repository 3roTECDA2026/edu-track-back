import { Role } from '@prisma/client'
import { Router } from 'express'

import * as fortePlanController from '@/controllers/fortePlan.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const fortePlanRouter = Router()

// Ver los planes y sus reportes: el personal de la escuela, incluida la preceptoría
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Asignar alumnos y cambiar el plan: dirección, EOE/directivos y administración
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

fortePlanRouter.use(verifyToken)

fortePlanRouter.get('/', canView, asyncHandler(fortePlanController.listFortePlans))
// El personal que puede ser responsable del seguimiento (para el diálogo de asignación)
fortePlanRouter.get(
  '/responsibles',
  canManage,
  asyncHandler(fortePlanController.listResponsibleCandidates)
)
fortePlanRouter.post('/', canManage, asyncHandler(fortePlanController.createFortePlan))
fortePlanRouter.patch('/:id', canManage, asyncHandler(fortePlanController.updateFortePlan))
fortePlanRouter.get('/:id/reports', canView, asyncHandler(fortePlanController.listFortePlanReports))
// Cargar reportes: además de la dirección, el docente responsable del plan (lo controla el
// service). La preceptoría solo los ve
fortePlanRouter.post(
  '/:id/reports',
  requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE, Role.TEACHER),
  asyncHandler(fortePlanController.createFortePlanReport)
)
