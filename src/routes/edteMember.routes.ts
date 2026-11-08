import { Role } from '@prisma/client'
import { Router } from 'express'

import * as edteMemberController from '@/controllers/edteMember.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const edteMemberRouter = Router()

// Ver los integrantes del EDTE: personal de la escuela
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER
)

// Dar de alta, editar y dar de baja: EOE/directivos y administración (criterio 3); el resto, 403
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

edteMemberRouter.use(verifyToken)

edteMemberRouter.get('/', canView, asyncHandler(edteMemberController.listEdteMembers))
edteMemberRouter.post('/', canManage, asyncHandler(edteMemberController.createEdteMember))
edteMemberRouter.patch('/:id', canManage, asyncHandler(edteMemberController.updateEdteMember))
edteMemberRouter.patch(
  '/:id/deactivate',
  canManage,
  asyncHandler(edteMemberController.deactivateEdteMember)
)
