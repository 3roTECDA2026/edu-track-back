import { Role } from '@prisma/client'
import { Router } from 'express'

import * as edteMeetingController from '@/controllers/edteMeeting.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const edteMeetingRouter = Router()

// Ver las reuniones: personal de la escuela que puede integrar el EDTE
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Cargar, editar y firmar: dirección, EOE/directivos y administración
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

edteMeetingRouter.use(verifyToken)

edteMeetingRouter.get('/', canView, asyncHandler(edteMeetingController.listEdteMeetings))
// Antes de "/:id", para que "candidates" no se tome como un id
edteMeetingRouter.get(
  '/candidates',
  canManage,
  asyncHandler(edteMeetingController.getEdteMeetingCandidates)
)
edteMeetingRouter.get('/:id', canView, asyncHandler(edteMeetingController.getEdteMeeting))
edteMeetingRouter.post('/', canManage, asyncHandler(edteMeetingController.createEdteMeeting))
edteMeetingRouter.patch('/:id', canManage, asyncHandler(edteMeetingController.updateEdteMeeting))
edteMeetingRouter.patch('/:id/sign', canManage, asyncHandler(edteMeetingController.signEdteMeeting))
