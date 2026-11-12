import { Router } from 'express'
import { Role } from '@prisma/client'

import { verifyToken, requireRole } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'
import * as legalConflictController from '@/controllers/legalConflict.controller'
import * as conflictSignatureController from '@/controllers/conflictSignature.controller'

export const legalConflictRouter = Router()

// CRM-090: acceso exclusivo al EOE y al Equipo Directivo
// Los demás roles, incluido ADMINISTRATOR, reciben 403 Forbidden
legalConflictRouter.use(verifyToken, requireRole(Role.EOE_DIRECTIVE, Role.SCHOOL_MANAGEMENT))

// Listar los conflictos legales de un estudiante
legalConflictRouter.get('/student/:studentId', asyncHandler(legalConflictController.listByStudent))

// Consultar catálogo de códigos normalizados
legalConflictRouter.get('/codes', asyncHandler(legalConflictController.listCodes))

// Consultar un conflicto legal por ID
legalConflictRouter.get('/:id', asyncHandler(legalConflictController.getById))

// Registrar un nuevo conflicto legal
legalConflictRouter.post('/', asyncHandler(legalConflictController.create))

legalConflictRouter.post('/:id/sign', asyncHandler(conflictSignatureController.sign))
