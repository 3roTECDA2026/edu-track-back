import { Role } from '@prisma/client'
import { Router } from 'express'

import * as edteTeamMemberController from '@/controllers/edteTeamMember.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const edteTeamMemberRouter = Router()

// Ver los integrantes del EDTE: el personal de la escuela, incluida la preceptoría (que lo integra)
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Dar de alta, editar y dar de baja: EOE/directivos y administración (criterio 3); el resto, 403
const canManage = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE)

edteTeamMemberRouter.use(verifyToken)

edteTeamMemberRouter.get('/', canView, asyncHandler(edteTeamMemberController.listEdteTeamMembers))
edteTeamMemberRouter.post(
  '/',
  canManage,
  asyncHandler(edteTeamMemberController.createEdteTeamMember)
)
edteTeamMemberRouter.patch(
  '/:id',
  canManage,
  asyncHandler(edteTeamMemberController.updateEdteTeamMember)
)
edteTeamMemberRouter.patch(
  '/:id/deactivate',
  canManage,
  asyncHandler(edteTeamMemberController.deactivateEdteTeamMember)
)
