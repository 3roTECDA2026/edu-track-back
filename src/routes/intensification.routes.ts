import { Role } from '@prisma/client'
import { Router } from 'express'

import * as intensificationController from '@/controllers/intensification.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const intensificationRouter = Router()

// Ver las asignaciones: personal de la escuela
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.PRECEPTOR,
  Role.TEACHER
)

// Asignar, cambiar el modelo o quitar: dirección o administración
const canEdit = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT)

// Cargar el resultado: dirección, administración o docentes
// (un docente solo el de sus alumnos: lo controla el service)
const canRegisterResult = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.TEACHER)

intensificationRouter.use(verifyToken)

intensificationRouter.get('/', canView, asyncHandler(intensificationController.listIntensifications))
intensificationRouter.get(
  '/candidates',
  canView,
  asyncHandler(intensificationController.listCandidates)
)
intensificationRouter.post('/', canEdit, asyncHandler(intensificationController.assignIntensifications))
intensificationRouter.patch(
  '/:id/result',
  canRegisterResult,
  asyncHandler(intensificationController.registerResult)
)
intensificationRouter.patch('/:id', canEdit, asyncHandler(intensificationController.updatePlacement))
intensificationRouter.delete(
  '/:id',
  canEdit,
  asyncHandler(intensificationController.removeIntensification)
)