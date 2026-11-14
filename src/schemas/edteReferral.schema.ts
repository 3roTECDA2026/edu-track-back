import { Shift } from '@prisma/client'
import { z } from 'zod'

// Listado de derivación al EDTE (E4-RF-02, CRM-073)

// Filtros: el ciclo que se cerró (obligatorio) y el curso en el que estaba el alumno en ese ciclo
export const listEdteReferralsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  grade: z.coerce.number().int().min(1).max(7).optional(),
  division: z.string().trim().min(1).max(5).optional(),
  shift: z.enum(Shift).optional(),
})

export type ListEdteReferralsQuery = z.infer<typeof listEdteReferralsQuerySchema>
