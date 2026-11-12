import { Router } from 'express'
import { Role } from '@prisma/client'
import { verifyToken, requireRole } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'
import * as conflictTotpController from '@/controllers/conflictTotp.controller'
import * as recoveryController from '@/controllers/conflictTotpRecovery.controller'

export const conflictTotpRouter = Router()

// Solo EOE y Equipo Directivo pueden vincular un autenticador
// para firmar actas de conflicto.
conflictTotpRouter.use(verifyToken, requireRole(Role.EOE_DIRECTIVE, Role.SCHOOL_MANAGEMENT))

conflictTotpRouter.post('/enroll', asyncHandler(conflictTotpController.startEnrollment))

conflictTotpRouter.post('/confirm', asyncHandler(conflictTotpController.confirmEnrollment))

// El titular solicita recuperar su autenticador.
conflictTotpRouter.post('/recovery/request', asyncHandler(recoveryController.requestRecovery))

// Solo otro directivo puede autorizar la recuperación.
conflictTotpRouter.post(
  '/recovery/approve',
  requireRole(Role.SCHOOL_MANAGEMENT),
  asyncHandler(recoveryController.approveRecovery)
)
