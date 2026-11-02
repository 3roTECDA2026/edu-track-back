import { z } from 'zod'

// Asistencia en intensificación (CRM-059)

// Fecha en formato AAAA-MM-DD
const dateSchema = z.string().date()

// Valores que se cargan en la pantalla: presente, ausente o ausente con justificación
export const INTENSIFICATION_ATTENDANCE_VALUES = ['PRESENT', 'ABSENT', 'EXCUSED'] as const

// Alumnos de un período y una materia, con la asistencia ya cargada en esa fecha
export const intensificationAttendanceQuerySchema = z.object({
  scheduleId: z.guid(),
  subjectId: z.guid(),
  date: dateSchema,
})

// Carga de la asistencia de un día
export const saveIntensificationAttendanceSchema = z.object({
  scheduleId: z.guid(),
  subjectId: z.guid(),
  date: dateSchema,
  records: z
    .array(
      z.object({
        intensificationId: z.guid(),
        value: z.enum(INTENSIFICATION_ATTENDANCE_VALUES),
      })
    )
    .min(1)
    .max(200)
    .superRefine((records, context) => {
      const ids = new Set<string>()
      records.forEach((record, index) => {
        if (ids.has(record.intensificationId)) {
          context.addIssue({
            code: 'custom',
            message: 'Cada alumno puede aparecer una sola vez',
            path: [index, 'intensificationId'],
          })
        }
        ids.add(record.intensificationId)
      })
    }),
})

export type IntensificationAttendanceValue = (typeof INTENSIFICATION_ATTENDANCE_VALUES)[number]
export type IntensificationAttendanceQuery = z.infer<typeof intensificationAttendanceQuerySchema>
export type SaveIntensificationAttendanceInput = z.infer<
  typeof saveIntensificationAttendanceSchema
>
