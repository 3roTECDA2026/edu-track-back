import { Role } from '@prisma/client'
import { Router } from 'express'

import * as c from '@/controllers/edteTeamMember.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const edteTeamMemberRouter = Router()

edteTeamMemberRouter.get('/', verifyToken, requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE), asyncHandler(c.list))
edteTeamMemberRouter.post('/', verifyToken, requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE), asyncHandler(c.create))
edteTeamMemberRouter.put('/:id', verifyToken, requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE), asyncHandler(c.update))
edteTeamMemberRouter.delete('/:id', verifyToken, requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE), asyncHandler(c.remove))
