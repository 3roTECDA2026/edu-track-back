import { FortePlanStatus } from '@prisma/client'
import { z } from 'zod'

import { todayInSchoolTimeZone } from '@/utils/schoolDate'

// Plan Forte (E4-RF-14, CRM-089)

const goalsText = z.string().trim().min(1, 'Cargá los objetivos pedagógicos').max(2000)
const longText = z.string().trim().max(2000)

export const fortePlanIdParamSchema = z.object({
  id: z.guid(),
})

// Listado. Sin status: los activos; con studentId y sin status, el plan de ese alumno en
// cualquier estado (para su ficha)
export const listFortePlansQuerySchema = z.object({
  status: z.enum([...Object.values(FortePlanStatus), 'ALL']).optional(),
  studentId: z.guid().optional(),
})

// Alta (o reactivación) de un alumno en el programa
export const createFortePlanSchema = z.object({
  studentId: z.guid(),
  responsibleId: z.guid(),
  pedagogicalGoals: goalsText,
})

// Cambiar los objetivos, el responsable o cerrar el plan (finalizar o dar de baja).
// Reactivar un plan no se hace acá: se hace con el alta, que valida al alumno y al responsable
export const updateFortePlanSchema = z
  .object({
    pedagogicalGoals: goalsText.optional(),
    responsibleId: z.guid().optional(),
    status: z.enum([FortePlanStatus.COMPLETED, FortePlanStatus.WITHDRAWN]).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay cambios para guardar',
  })

// Reporte de evolución (separado del boletín)
export const createFortePlanReportSchema = z
  .object({
    progress: z.string().trim().min(1, 'Cargá la evolución del alumno').max(2000),
    observations: longText.nullable().optional(),
    // Fecha del reporte (AAAA-MM-DD). Si no viene, la de hoy
    date: z.iso.date().optional(),
  })
  .superRefine((data, context) => {
    // "Hoy" según la hora de Argentina (no la de UTC, que de noche ya es el día siguiente)
    if (data.date && data.date > todayInSchoolTimeZone()) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha del reporte no puede ser futura',
        path: ['date'],
      })
    }
  })

export type ListFortePlansQuery = z.infer<typeof listFortePlansQuerySchema>
export type CreateFortePlanInput = z.infer<typeof createFortePlanSchema>
export type UpdateFortePlanInput = z.infer<typeof updateFortePlanSchema>
export type CreateFortePlanReportInput = z.infer<typeof createFortePlanReportSchema>
