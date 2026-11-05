import { Role } from '@prisma/client'
import { Router } from 'express'

import * as attendanceController from '@/controllers/attendance.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

const router = Router()

// Ver la asistencia: personal de la escuela. Estudiantes y familias tendrán su propio acceso (etapa 7).
const canView = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.EOE_DIRECTIVE, Role.TEACHER)

// Cargar y justificar: quienes toman asistencia y la dirección.
// Corregir días anteriores queda limitado a preceptoría, dirección y administración (en el service).
const canRegister = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT, Role.TEACHER)

// Días hábiles del ciclo: los define la dirección
const canManageSchoolDays = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT)

router.use(verifyToken)

router.post('/batch', canRegister, asyncHandler(attendanceController.saveBatch))
router.patch('/:id/justify', canRegister, asyncHandler(attendanceController.justify))

router.get('/school-days', canView, asyncHandler(attendanceController.getSchoolDays))
router.put('/school-days', canManageSchoolDays, asyncHandler(attendanceController.updateSchoolDays))

router.get('/sections', canView, asyncHandler(attendanceController.listAttendanceSections))
router.get('/section/:sectionId', canView, asyncHandler(attendanceController.getSectionAttendance))
router.get('/', canView, asyncHandler(attendanceController.listAttendances))
router.get('/summary', canView, asyncHandler(attendanceController.getSummary))

export default router