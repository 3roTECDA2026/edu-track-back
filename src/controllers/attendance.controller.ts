import type { Request, Response } from 'express'
import {
  batchAttendanceSchema,
  paginationAttendanceSchema,
  justificationSchema,
} from '@/schemas/attendance.schema'
import * as attendanceService from '@/services/attendance.service'

// 1. Controlador para la carga masiva diaria
export async function saveBatch(req: Request, res: Response) {
  try {
    const input = batchAttendanceSchema.parse(req.body)
    const result = await attendanceService.saveBatchAttendance(input)
    return res.status(201).json(result)
  } catch (error: any) {
    console.error('❌ Error en saveBatch:', error) // <-- ¡Agregamos esto para ver el error real!

    if (error.name === 'ZodError') {
      return res
        .status(400)
        .json({ message: 'Datos de asistencia inválidos.', errors: error.issues })
    }
    return res.status(400).json({ message: error.message || 'No se pudo registrar la asistencia.' })
  }
}

// 2. Controlador para listar o filtrar asistencias
export async function listAttendances(req: Request, res: Response) {
  try {
    const filters = paginationAttendanceSchema.parse(req.query)
    const result = await attendanceService.getAttendanceSummary(filters)
    return res.json(result)
  } catch (error: any) {
    console.error('❌ Error en listAttendances:', error) // <-- ¡Acá también!

    if (error.name === 'ZodError') {
      return res
        .status(400)
        .json({ message: 'Filtros de asistencia inválidos.', errors: error.issues })
    }
    return res.status(500).json({ message: 'No se pudieron obtener las asistencias.' })
  }
}

// 3. Controlador para obtener el resumen de inasistencias (AttendanceSummaryPage)
export async function getSummary(req: Request, res: Response) {
  try {
    const filters = paginationAttendanceSchema.parse(req.query)
    const result = await attendanceService.getAttendanceSummary(filters)
    return res.json(result)
  } catch (error: any) {
    console.error('❌ Error en getSummary:', error) // <-- ¡Y acá también!

    if (error.name === 'ZodError') {
      return res
        .status(400)
        .json({ message: 'Filtros de resumen inválidos.', errors: error.issues })
    }
    return res.status(500).json({ message: 'No se pudo obtener el resumen de asistencias.' })
  }
}
// 4. Controlador para justificar una inasistencia específica
export async function justify(req: Request, res: Response) {
  try {
    const id = req.params.id as string // <-- Le decimos a TypeScript: "tranquilo, esto es un string"
    const { justification } = justificationSchema.parse(req.body)

    const result = await attendanceService.justifyAttendance(id, justification)
    return res.json(result)
  } catch (error: any) {
    console.error('❌ Error en justify:', error)

    if (error.name === 'ZodError') {
      return res
        .status(400)
        .json({ message: 'La justificación es obligatoria.', errors: error.issues })
    }
    return res.status(404).json({ message: 'No se encontró la asistencia a justificar.' })
  }
}
