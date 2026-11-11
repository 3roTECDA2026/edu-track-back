import { Role } from '@prisma/client'
import { Router } from 'express'

import * as classSectionController from '@/controllers/classSection.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const classSectionRouter = Router()

// Ver los cursos: personal de la escuela (lo usan los selectores de varias pantallas).
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

classSectionRouter.use(verifyToken)

classSectionRouter.get('/', canView, asyncHandler(classSectionController.listClassSections))