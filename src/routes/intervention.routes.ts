import { Role } from '@prisma/client'
import { Router } from 'express'

import * as interventionController from '@/controllers/intervention.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const interventionRouter = Router()

// Roles que pueden trabajar con intervenciones (criterio 3): preceptor, docente, EOE/dirección + admin.
const INTERVENTION_ROLES: Role[] = [
  Role.PRECEPTOR,
  Role.TEACHER,
  Role.EOE_DIRECTIVE,
  Role.SCHOOL_MANAGEMENT,
  Role.ADMINISTRATOR,
]

// Listar (por alumno/curso, con filtros)
interventionRouter.get(
  '/',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.listInterventions)
)

// Detalle
interventionRouter.get(
  '/:id',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.getInterventionById)
)

// Crear
interventionRouter.post(
  '/',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.createIntervention)
)

// Editar (el service valida que sea el autor y la ventana de 48 hs)
interventionRouter.put(
  '/:id',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.updateIntervention)
)