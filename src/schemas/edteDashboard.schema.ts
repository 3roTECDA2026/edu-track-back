import { PreliminaryAssessment, Term } from '@prisma/client'
import { z } from 'zod'

// Filtros del dashboard del EDTE (CRM-077). Se aplican a las tarjetas y al listado juntos.
export const edteDashboardQuerySchema = z.object({
  term: z.enum(Term).optional(), // Sin term: el cuatrimestre en curso
  assessment: z.enum(PreliminaryAssessment).optional(), // Valoración del alumno (la peor)
  grade: z.coerce.number().int().min(1).max(7).optional(), // Año
  classSectionId: z.guid().optional(), // Sección
})

export type EdteDashboardQuery = z.infer<typeof edteDashboardQuerySchema>
