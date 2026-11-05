import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  intensificationAttendanceQuerySchema,
  saveIntensificationAttendanceSchema,
} from '@/schemas/intensificationAttendance.schema'
import * as intensificationAttendanceService from '@/services/intensificationAttendance.service'

// Asistencia en intensificación (CRM-059)

export async function getAttendance(req: Request, res: Response) {
  const query = intensificationAttendanceQuerySchema.parse(req.query)
  res.json(await intensificationAttendanceService.getIntensificationAttendance(query))
}

// El usuario logueado decide de qué alumnos puede cargar (docente responsable o dirección)
export async function saveAttendance(req: Request, res: Response) {
  const input = saveIntensificationAttendanceSchema.parse(req.body)
  const { userId, role } = getAuthUser(req)
  res.json(
    await intensificationAttendanceService.saveIntensificationAttendance(input, { userId, role })
  )
}
