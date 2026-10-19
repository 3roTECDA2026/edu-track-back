import { z } from 'zod'
import { Term } from '@prisma/client'

// Los ids se validan con z.guid() (formato 8-4-4-4-12) y no con z.uuid(), que en Zod 4
// exige un UUID con versión válida y rechaza los ids fijos del seed (00000000-...).
export const riteIdParamSchema = z.object({
  id: z.guid(),
})

export const listRitesQuerySchema = z.object({
  studentId: z.guid(),
})

// Se crea con el año del ciclo lectivo (ej: 2026), que es lo que el front tiene a mano.
// El RITE post-intensificación (E2-RF-12) se guarda siempre como del 2° cuatrimestre.
export const createRiteSchema = z.object({
  studentId: z.guid(),
  year: z.number().int().min(2000).max(2100),
  term: z.enum(Term),
  isPostIntensification: z.boolean().default(false),
})

export const updateRiteNotesSchema = z.object({
  generalNotes: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
})

export type CreateRiteInput = z.infer<typeof createRiteSchema>
export type UpdateRiteNotesInput = z.infer<typeof updateRiteNotesSchema>