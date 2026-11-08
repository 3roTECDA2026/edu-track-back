import { EdteRole } from '@prisma/client'
import { z } from 'zod'

// Integrantes del EDTE (E4-RF-01, CRM-071)

export const edteMemberIdParamSchema = z.object({
  id: z.guid(),
})

// Por defecto se listan solo los activos; "inactive" muestra los dados de baja y "all", todos
export const listEdteMembersQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).default('active'),
})

// Alta: qué usuario integra el equipo y con qué rol
export const createEdteMemberSchema = z.object({
  userId: z.guid(),
  edteRole: z.enum(EdteRole),
})

// Edición: el rol dentro del equipo
export const updateEdteMemberSchema = z.object({
  edteRole: z.enum(EdteRole),
})

export type ListEdteMembersQuery = z.infer<typeof listEdteMembersQuerySchema>
export type CreateEdteMemberInput = z.infer<typeof createEdteMemberSchema>
export type UpdateEdteMemberInput = z.infer<typeof updateEdteMemberSchema>
