import { z } from 'zod'
import { Term } from '@prisma/client'

export const riteIdParamSchema = z.object({
  id: z.uuid(),
})

export const listRitesQuerySchema = z.object({
  studentId: z.uuid(),
})

// Se crea con el año del ciclo lectivo (ej: 2026), que es lo que el front tiene a mano.
export const createRiteSchema = z.object({
  studentId: z.uuid(),
  year: z.number().int().min(2000).max(2100),
  term: z.enum(Term),
})

export const updateRiteNotesSchema = z.object({
  generalNotes: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
})

export type CreateRiteInput = z.infer<typeof createRiteSchema>
export type UpdateRiteNotesInput = z.infer<typeof updateRiteNotesSchema>