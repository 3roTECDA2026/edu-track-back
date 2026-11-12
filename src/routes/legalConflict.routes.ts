import { Router } from 'express'
import type { Request, Response } from 'express'
import { Role } from '@prisma/client'

import { verifyToken, requireRole } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'
import * as legalConflictController from '@/controllers/legalConflict.controller'
import * as conflictSignatureController from '@/controllers/conflictSignature.controller'
import * as attachmentController from '@/controllers/legalConflictAttachment.controller'

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

// Firmar un acta mediante TOTP
legalConflictRouter.post('/:id/sign', asyncHandler(conflictSignatureController.sign))

// CRM-092: agregar anexos inmutables
legalConflictRouter.post('/:id/attachments', asyncHandler(attachmentController.create))

// No se permite modificar ni eliminar anexos
const rejectAttachmentMutation = (_req: Request, res: Response): void => {
  res.status(405).json({
    success: false,
    message: 'Los anexos son inmutables y no pueden modificarse ni eliminarse',
  })
}

legalConflictRouter.put('/:id/attachments/:attachmentId', rejectAttachmentMutation)
legalConflictRouter.patch('/:id/attachments/:attachmentId', rejectAttachmentMutation)
legalConflictRouter.delete('/:id/attachments/:attachmentId', rejectAttachmentMutation)
