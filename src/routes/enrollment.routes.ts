import { Role } from '@prisma/client'
import { Router } from 'express'

import * as enrollmentController from '@/controllers/enrollment.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const enrollmentRouter = Router()

// Inscribir y modificar la cursada de materias: administración, dirección y preceptoría.
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.PRECEPTOR)

enrollmentRouter.use(verifyToken)

enrollmentRouter.post('/', canManage, asyncHandler(enrollmentController.createEnrollment))
enrollmentRouter.put('/:id', canManage, asyncHandler(enrollmentController.updateEnrollment))