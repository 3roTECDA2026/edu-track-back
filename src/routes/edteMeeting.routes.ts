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

// Cargar y editar: dirección, EOE/directivos y administración
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

edteMeetingRouter.use(verifyToken)

edteMeetingRouter.get('/', canView, asyncHandler(edteMeetingController.listEdteMeetings))
// Antes de "/:id", para que "candidates" no se tome como un id
edteMeetingRouter.get(
  '/candidates',
  canManage,
  asyncHandler(edteMeetingController.getEdteMeetingCandidates)
)
// Personal que se puede convocar (checklist del formulario)
edteMeetingRouter.get(
  '/member-options',
  canManage,
  asyncHandler(edteMeetingController.getEdteMeetingMemberOptions)
)
edteMeetingRouter.get('/:id', canView, asyncHandler(edteMeetingController.getEdteMeeting))
// Acta en PDF: la baja cualquiera que vea la reunión, también en borrador, para
// leerla antes de firmar
edteMeetingRouter.get(
  '/:id/minutes',
  canView,
  asyncHandler(edteMeetingController.getEdteMeetingMinutes)
)
edteMeetingRouter.post('/', canManage, asyncHandler(edteMeetingController.createEdteMeeting))
edteMeetingRouter.patch('/:id', canManage, asyncHandler(edteMeetingController.updateEdteMeeting))
// Firma del acta (CRM-076): firma cada integrante presente; el service controla que lo sea
edteMeetingRouter.patch('/:id/sign', canView, asyncHandler(edteMeetingController.signEdteMeeting))
