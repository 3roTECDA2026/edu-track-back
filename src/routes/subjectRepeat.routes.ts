import { Role } from '@prisma/client'
import { Router } from 'express'

import * as subjectRepeatController from '@/controllers/subjectRepeat.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

// Recursado de materias (CRM-082, E4-RF-09)
export const subjectRepeatRouter = Router()

// Quién asigna, edita y quita recursados (decisión del equipo, CRM-082).
// PENDIENTE: definir si PRECEPTOR también asigna ("Gestión Escolar" incluye a Preceptoría
// en el documento de requerimientos). Hasta entonces solo ve.
export const SUBJECT_REPEAT_MANAGER_ROLES: Role[] = [
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
]

// Quién puede ver los recursados: el personal de la escuela
const SUBJECT_REPEAT_VIEWER_ROLES: Role[] = [
  ...SUBJECT_REPEAT_MANAGER_ROLES,
  Role.TEACHER,
  Role.PRECEPTOR,
]

const canView = requireRole(...SUBJECT_REPEAT_VIEWER_ROLES)
const canManage = requireRole(...SUBJECT_REPEAT_MANAGER_ROLES)

subjectRepeatRouter.use(verifyToken)

subjectRepeatRouter.get('/', canView, asyncHandler(subjectRepeatController.listSubjectRepeats))
// Antes de "/:id", para que "options" no se tome como un id
subjectRepeatRouter.get(
  '/options',
  canManage,
  asyncHandler(subjectRepeatController.getRepeatOptions)
)
subjectRepeatRouter.post('/', canManage, asyncHandler(subjectRepeatController.createSubjectRepeat))
subjectRepeatRouter.patch(
  '/:id',
  canManage,
  asyncHandler(subjectRepeatController.updateSubjectRepeat)
)
subjectRepeatRouter.delete(
  '/:id',
  canManage,
  asyncHandler(subjectRepeatController.deleteSubjectRepeat)
)
