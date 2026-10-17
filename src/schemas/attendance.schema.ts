import { AttendanceValue } from '@prisma/client'
import { z } from 'zod'

// Validador de formato de fecha YYYY-MM-DD
const dateSchema = z.string().date()

// Esquema para validar los query params de los listados y resúmenes
export const paginationAttendanceSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  studentId: z.string().optional(),
  search: z.string().trim().optional(),
  sectionId: z.string().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  value: z.nativeEnum(AttendanceValue).optional(),
  justified: z
    .enum(['true', 'false'])
    .transform((item) => item === 'true')
    .optional(),
})

// Esquema para validar la carga masiva (batch) desde la pantalla de Carga Diaria
export const batchAttendanceSchema = z.object({
  date: dateSchema,
  sectionId: z.string().min(1),
  registeredById: z.string().min(1),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        value: z.nativeEnum(AttendanceValue),
      })
    )
    .min(1),
})

// Esquema para validar la justificación de una inasistencia
export const justificationSchema = z.object({
  justification: z.string().trim().min(1),
})
