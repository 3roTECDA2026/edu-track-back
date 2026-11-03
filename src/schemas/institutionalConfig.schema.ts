import { OrganizationalModel } from '@prisma/client'
import { z } from 'zod'

// Actualizar el modelo organizativo institucional (E3-RF-15).
// Solo se elige el modelo (A/B/C/D) y, opcionalmente, desde que fecha rige.
export const updateInstitutionalConfigSchema = z.object({
  organizationalModel: z.enum(OrganizationalModel),
  adoptedAt: z.coerce.date().optional(), // si no viene, rige desde hoy
})

export type UpdateInstitutionalConfigInput = z.infer<typeof updateInstitutionalConfigSchema>