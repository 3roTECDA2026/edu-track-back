import { IntensificationPeriod } from '@prisma/client'
import { z } from 'zod'

// Fecha en formato AAAA-MM-DD
const dateSchema = z.string().date()

export const scheduleIdParamSchema = z.object({
  id: z.uuid(),
})

export const scheduleSubjectParamSchema = z.object({
  id: z.uuid(),
  entryId: z.uuid(),
})

export const listSchedulesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
})

// Un período de intensificación de un ciclo lectivo (E3-RF-04)
export const createScheduleSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    period: z.enum(IntensificationPeriod),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  })

export const updateScheduleSchema = z
  .object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .refine((data) => data.startDate !== undefined || data.endDate !== undefined, {
    message: 'Hay que enviar al menos una fecha',
  })

// Materia que se intensifica en el período, con su docente responsable
export const addScheduleSubjectSchema = z.object({
  subjectId: z.uuid(),
  teacherId: z.uuid().nullable().optional(),
})

export const updateScheduleSubjectSchema = z.object({
  teacherId: z.uuid().nullable(),
})

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
export type AddScheduleSubjectInput = z.infer<typeof addScheduleSubjectSchema>
export type UpdateScheduleSubjectInput = z.infer<typeof updateScheduleSubjectSchema>