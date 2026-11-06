import { Router } from 'express'
import * as matriculationController from '@/controllers/matriculation.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'
import { Role } from '@prisma/client'

const router = Router()

const canRun = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT)

router.use(verifyToken)

router.post('/run', canRun, asyncHandler(matriculationController.run))
export default router
