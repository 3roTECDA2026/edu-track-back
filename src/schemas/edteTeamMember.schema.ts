import { EdteRole, Shift } from '@prisma/client'
import { z } from 'zod'

// Integrantes del EDTE (E4-RF-01, CRM-071). Hay un EDTE por turno (Anexo 2, inc. 22)

export const edteTeamMemberIdParamSchema = z.object({
  id: z.guid(),
})

// Por defecto se listan solo los activos; "inactive" muestra los dados de baja y "all", todos.
// Con shift, solo el EDTE de ese turno
export const listEdteTeamMembersQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  shift: z.enum(Shift).optional(),
})

// Alta: qué usuario integra el EDTE, de qué turno y con qué rol
export const createEdteTeamMemberSchema = z.object({
  userId: z.guid(),
  shift: z.enum(Shift),
  edteRole: z.enum(EdteRole),
})

// Edición: el rol dentro del equipo
export const updateEdteTeamMemberSchema = z.object({
  edteRole: z.enum(EdteRole),
})

export type ListEdteTeamMembersQuery = z.infer<typeof listEdteTeamMembersQuerySchema>
export type CreateEdteTeamMemberInput = z.infer<typeof createEdteTeamMemberSchema>
export type UpdateEdteTeamMemberInput = z.infer<typeof updateEdteTeamMemberSchema>
