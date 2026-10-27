import { AttendanceValue } from '@prisma/client'
import { z } from 'zod'

// Validador de formato de fecha AAAA-MM-DD
const dateSchema = z.string().date()

// Esquema para validar los query params de los listados y resúmenes
export const paginationAttendanceSchema = z
  .object({
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
  period: z.enum(['FULL', 'FIRST', 'SECOND']).optional(),
  })
  .refine((filters) => !filters.from || !filters.to || filters.from <= filters.to, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin',
    path: ['from'],
  })

export type PaginationAttendanceFilters = z.infer<typeof paginationAttendanceSchema>

export const sectionAttendanceQuerySchema = z.object({
  date: dateSchema,
})

export const attendanceIdParamSchema = z.object({
  id: z.string().trim().min(1),
})

export const attendanceSectionIdParamSchema = z.object({
  sectionId: z.string().trim().min(1),
})

// Esquema para validar la carga masiva (batch) desde la pantalla de carga diaria
export const batchAttendanceSchema = z.object({
  date: dateSchema,
  sectionId: z.string().trim().min(1),
  records: z
    .array(
      z.object({
        studentId: z.string().trim().min(1),
        value: z.nativeEnum(AttendanceValue),
        // La J del wireframe: una falta (ABSENT) que se marca como justificada en la carga diaria
        justified: z.boolean().optional(),
      })
    )
    .min(1)
    .superRefine((records, context) => {
      const studentIds = new Set<string>()
      records.forEach((record, index) => {
        if (studentIds.has(record.studentId)) {
          context.addIssue({
            code: 'custom',
            message: 'Cada alumno puede aparecer una sola vez',
            path: [index, 'studentId'],
          })
        }
        studentIds.add(record.studentId)

        if (record.justified && record.value !== AttendanceValue.ABSENT) {
          context.addIssue({
            code: 'custom',
            message: 'Solo una inasistencia (ausente) puede marcarse como justificada',
            path: [index, 'justified'],
          })
        }
      })
    }),
})

// Esquema para validar la justificación de una inasistencia
export const justificationSchema = z.object({
  justification: z.string().trim().min(1, 'La justificación es obligatoria'),
})
// Días hábiles del ciclo lectivo (modal de días hábiles)
const schoolDaysValue = z.number().int().min(0).max(366).nullable()

export const schoolDaysQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
})

export const updateSchoolDaysSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  term1SchoolDays: schoolDaysValue,
  term2SchoolDays: schoolDaysValue,
  totalSchoolDays: schoolDaysValue,
})

export type UpdateSchoolDaysInput = z.infer<typeof updateSchoolDaysSchema>