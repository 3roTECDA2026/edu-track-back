import { OrganizationalModel } from '@prisma/client'
import { z } from 'zod'

// Actualizar el modelo organizativo institucional (E3-RF-15).
// Solo se elige el modelo (A/B/C/D). La fecha de vigencia la pone el back (hoy).
export const updateInstitutionalConfigSchema = z.object({
  organizationalModel: z.enum(OrganizationalModel),
})

export type UpdateInstitutionalConfigInput = z.infer<typeof updateInstitutionalConfigSchema>
