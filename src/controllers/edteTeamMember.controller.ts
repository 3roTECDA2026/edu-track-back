import type { Request, Response } from 'express'

import * as edteTeamMemberService from '@/services/edteTeamMember.service'
import { createEdteTeamMemberSchema, updateEdteTeamMemberSchema } from '@/schemas/edteTeamMember.schema'
import { sendSuccess } from '@/utils/apiResponse'

export async function list(_req: Request, res: Response) {
  sendSuccess(res, await edteTeamMemberService.listEdteTeamMembers(), 'Integrantes obtenidos')
}

export async function create(req: Request, res: Response) {
  const { userId, roleInTeam, active } = createEdteTeamMemberSchema.parse(req.body)
  sendSuccess(res, await edteTeamMemberService.createEdteTeamMember({ userId, roleInTeam, active }), 'Integrante creado')
}

export async function update(req: Request, res: Response) {
  const id = req.params.id as string
  const { roleInTeam, active } = updateEdteTeamMemberSchema.parse(req.body)
  sendSuccess(res, await edteTeamMemberService.updateEdteTeamMember(id, { roleInTeam, active }), 'Integrante actualizado')
}

export async function remove(req: Request, res: Response) {
  const id = req.params.id as string
  sendSuccess(res, await edteTeamMemberService.deactivateEdteTeamMember(id), 'Integrante dado de baja')
}
