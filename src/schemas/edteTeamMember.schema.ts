import { z } from 'zod'

export const createEdteTeamMemberSchema = z.object({
  userId: z.string().min(1),
  roleInTeam: z.string().min(1),
  active: z.boolean().optional(),
})

export const updateEdteTeamMemberSchema = z.object({
  roleInTeam: z.string().min(1).optional(),
  active: z.boolean().optional(),
})
