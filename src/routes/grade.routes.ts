import { Role } from '@prisma/client'
import { Router } from 'express'

import * as gradeController from '@/controllers/grade.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const gradeRouter = Router()

// Ver las notas: personal de la escuela. Estudiantes y familias tendrán su propio acceso.
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Cargar, corregir y borrar notas: dirección, administración, docentes y preceptoría.
const canRegister = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Borrar una nota: dirección, administración y docentes. El preceptor carga y edita, pero no borra
const canDelete = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.TEACHER)

gradeRouter.use(verifyToken)

gradeRouter.get('/', canView, asyncHandler(gradeController.listGrades))
gradeRouter.get('/roster', canView, asyncHandler(gradeController.getGradeRoster))
gradeRouter.get('/by-student', canView, asyncHandler(gradeController.getGradesByStudent))
gradeRouter.post('/', canRegister, asyncHandler(gradeController.createGrade))
gradeRouter.put('/:id', canRegister, asyncHandler(gradeController.updateGrade))
gradeRouter.delete('/:id', canRegister, asyncHandler(gradeController.deleteGrade))
