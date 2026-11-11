import { Role } from '@prisma/client'
import { Router } from 'express'

import * as intensificationAttendanceController from '@/controllers/intensificationAttendance.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

// Asistencia en intensificación (CRM-059)
export const intensificationAttendanceRouter = Router()

// Ver la asistencia: personal de la escuela
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.PRECEPTOR,
  Role.TEACHER
)

// Cargarla: dirección, administración o docentes
// (un docente solo la de sus alumnos: lo controla el service)
const canRegister = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.TEACHER, Role.PRECEPTOR)

intensificationAttendanceRouter.use(verifyToken)

intensificationAttendanceRouter.get(
  '/',
  canView,
  asyncHandler(intensificationAttendanceController.getAttendance)
)
intensificationAttendanceRouter.post(
  '/batch',
  canRegister,
  asyncHandler(intensificationAttendanceController.saveAttendance)
)
