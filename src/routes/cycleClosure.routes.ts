import { Role } from '@prisma/client'
import { Router } from 'express'

import * as cycleClosureController from '@/controllers/cycleClosure.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

// Cierre del ciclo lectivo (CRM-052): solo dirección o administración
export const cycleClosureRouter = Router()

cycleClosureRouter.use(verifyToken, requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT))

// La ruta fija (/preview) va antes que la paramétrica
cycleClosureRouter.get(
  '/:academicYearId/preview',
  asyncHandler(cycleClosureController.previewCycleClosure)
)
cycleClosureRouter.post('/:academicYearId', asyncHandler(cycleClosureController.closeCycle))
