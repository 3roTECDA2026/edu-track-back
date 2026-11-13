import { Role } from '@prisma/client'
import { Router } from 'express'

import * as institutionalConfigController from '@/controllers/institutionalConfig.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const institutionalConfigRouter = Router()

// Lectura: cualquier usuario autenticado puede ver el modelo vigente.
institutionalConfigRouter.get(
  '/',
  verifyToken,
  asyncHandler(institutionalConfigController.getInstitutionalConfig)
)

// Modificación: solo dirección o administración.
institutionalConfigRouter.put(
  '/',
  verifyToken,
  requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT),
  asyncHandler(institutionalConfigController.updateInstitutionalConfig)
)
