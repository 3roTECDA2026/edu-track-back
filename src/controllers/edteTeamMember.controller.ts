import type { Request, Response } from 'express'

import {
  createEdteTeamMemberSchema,
  edteTeamMemberIdParamSchema,
  listEdteTeamMembersQuerySchema,
  updateEdteTeamMemberSchema,
} from '@/schemas/edteTeamMember.schema'
import * as edteTeamMemberService from '@/services/edteTeamMember.service'

// Integrantes del EDTE (CRM-071): valida con Zod y le pasa los datos al service

export async function listEdteTeamMembers(req: Request, res: Response) {
  const query = listEdteTeamMembersQuerySchema.parse(req.query)
  res.json(await edteTeamMemberService.listEdteTeamMembers(query))
}

export async function createEdteTeamMember(req: Request, res: Response) {
  const input = createEdteTeamMemberSchema.parse(req.body)
  res.status(201).json(await edteTeamMemberService.createEdteTeamMember(input))
}

export async function updateEdteTeamMember(req: Request, res: Response) {
  const { id } = edteTeamMemberIdParamSchema.parse(req.params)
  const input = updateEdteTeamMemberSchema.parse(req.body)
  res.json(await edteTeamMemberService.updateEdteTeamMember(id, input))
}

export async function deactivateEdteTeamMember(req: Request, res: Response) {
  const { id } = edteTeamMemberIdParamSchema.parse(req.params)
  res.json(await edteTeamMemberService.deactivateEdteTeamMember(id))
}
