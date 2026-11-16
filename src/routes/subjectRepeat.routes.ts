import { Role } from '@prisma/client'
import { Router } from 'express'

import * as subjectRepeatController from '@/controllers/subjectRepeat.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

// Recursado de materias (CRM-082, E4-RF-09)
export const subjectRepeatRouter = Router()

// Quién ve, asigna, edita y quita recursados: Gestión Escolar (que en el documento de
// requerimientos incluye a Preceptoría), EOE/Directivos y Administración. Asignar y quitar lo
// decidió el equipo en CRM-082; ver, el criterio 5 de CRM-083. El docente no los ve: la marca R
// de la grilla y de la ficha sale de courseType en las notas, no de este endpoint
export const SUBJECT_REPEAT_MANAGER_ROLES: Role[] = [
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.PRECEPTOR,
]

const canManage = requireRole(...SUBJECT_REPEAT_MANAGER_ROLES)

subjectRepeatRouter.use(verifyToken)

subjectRepeatRouter.get('/', canManage, asyncHandler(subjectRepeatController.listSubjectRepeats))
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
