import { Role } from '@prisma/client'
import { Router } from 'express'

import * as studentController from '@/controllers/student.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const studentRouter = Router()

// Ver alumnos: personal de la escuela. Estudiantes y familias tendrán su propio acceso.
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Modificar los datos de un alumno: administración, dirección y preceptoría.
const canUpdate = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.PRECEPTOR)

// Dar de alta y de baja alumnos: solo administración y dirección.
const canAdminister = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT)

studentRouter.use(verifyToken)

studentRouter.get('/', canView, asyncHandler(studentController.listStudents))
studentRouter.patch('/:id/deactivate', canAdminister, asyncHandler(studentController.deactivateStudent))
studentRouter.post('/', canAdminister, asyncHandler(studentController.createStudent))
studentRouter.get('/:id', canView, asyncHandler(studentController.getStudent))
studentRouter.patch('/:id', canUpdate, asyncHandler(studentController.updateStudent))
studentRouter.get('/:id/history', canView, asyncHandler(studentController.getStudentHistory))