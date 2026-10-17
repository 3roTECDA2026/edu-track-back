import { Router } from 'express'
import * as attendanceController from '@/controllers/attendance.controller'

const router = Router()

// Endpoint para guardar o actualizar la asistencia diaria masiva (Carga Diaria)
router.post('/batch', attendanceController.saveBatch)

// Endpoint para obtener el listado general de asistencias
router.get('/', attendanceController.listAttendances)

// Endpoint para obtener el resumen agrupado de inasistencias por estudiante (Resumen)
router.get('/summary', attendanceController.getSummary)

// Endpoint para marcar una inasistencia como justificada
router.patch('/:id/justify', attendanceController.justify)

export default router
