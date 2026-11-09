import { Router } from 'express'
import { Role } from '@prisma/client'
import {
  verifyToken,
  requireRole,
} from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'
import * as conflictTotpController from '@/controllers/conflictTotp.controller'

export const conflictTotpRouter = Router()

// Solo EOE y Equipo Directivo pueden vincular un autenticador
// para firmar actas de conflicto.
conflictTotpRouter.use(
  verifyToken,
  requireRole(Role.EOE_DIRECTIVE, Role.SCHOOL_MANAGEMENT)
)

conflictTotpRouter.post(
  '/enroll',
  asyncHandler(conflictTotpController.startEnrollment)
)

conflictTotpRouter.post(
  '/confirm',
  asyncHandler(conflictTotpController.confirmEnrollment)
)
