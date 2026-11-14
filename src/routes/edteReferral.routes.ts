import { Role } from '@prisma/client'
import { Router } from 'express'

import * as edteReferralController from '@/controllers/edteReferral.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const edteReferralRouter = Router()

// Es información sensible de las trayectorias: la ven la dirección, el EOE/directivos y la
// administración
const canView = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

edteReferralRouter.use(verifyToken)

edteReferralRouter.get('/', canView, asyncHandler(edteReferralController.listEdteReferrals))
