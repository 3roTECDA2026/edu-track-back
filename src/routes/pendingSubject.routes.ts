import { Role } from '@prisma/client'
import { Router } from 'express'

import * as pendingSubjectController from '@/controllers/pendingSubject.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

// Saberes pendientes de las MPAA (E3-RF-02, CRM-053)
export const pendingSubjectRouter = Router()

// Ver las MPAA de un alumno: personal pedagógico y directivo
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER
)

// Cargar los saberes: el ticket no restringe más que para verlas. Se ajusta si el PM lo pide
const canEdit = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER
)

pendingSubjectRouter.use(verifyToken)

pendingSubjectRouter.get('/', canView, asyncHandler(pendingSubjectController.listPendingSubjects))
pendingSubjectRouter.patch(
  '/:id',
  canEdit,
  asyncHandler(pendingSubjectController.updatePendingKnowledge)
)
