import { z } from 'zod'
import { InterventionEventType } from '@prisma/client'

// IDs con z.guid(): acepta también los ids fijos del seed (00000000-...), que z.uuid() rechaza en Zod 4.

export const interventionIdParamSchema = z.object({
  id: z.guid(),
})

// Crear una intervención. El autor sale del token, no del body.
// description = "situación detectada"; interventionProposal = "propuesta de intervención".
export const createInterventionSchema = z.object({
  studentId: z.guid(),
  classSectionId: z.guid(),
  eventType: z.enum(InterventionEventType), // PEDAGOGICAL | HEALTH | CONDUCT
  description: z.string().trim().min(1, 'La situación detectada es obligatoria'),
  interventionProposal: z.string().trim().optional(),
  involvedActors: z.string().trim().optional(),
  date: z.coerce.date().optional(), // fecha del suceso; si no viene, se usa hoy
})

export type CreateInterventionInput = z.infer<typeof createInterventionSchema>

// Editar: solo campos de contenido. No se cambian alumno, curso ni autor.
export const updateInterventionSchema = createInterventionSchema
  .omit({ studentId: true, classSectionId: true })
  .partial()

export type UpdateInterventionInput = z.infer<typeof updateInterventionSchema>

// Listar con filtros (por alumno, por curso, por tipo y rango de fechas) + paginación.
export const listInterventionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  studentId: z.guid().optional(),
  classSectionId: z.guid().optional(),
  eventType: z.enum(InterventionEventType).optional(),
  from: z.coerce.date().optional(), // fecha desde (filtra por el campo date)
  to: z.coerce.date().optional(), // fecha hasta
})

export type ListInterventionsQuery = z.infer<typeof listInterventionsQuerySchema>