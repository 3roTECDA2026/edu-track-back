import type { Request, Response } from 'express'

import {
  createEdteMemberSchema,
  edteMemberIdParamSchema,
  listEdteMembersQuerySchema,
  updateEdteMemberSchema,
} from '@/schemas/edteMember.schema'
import * as edteMemberService from '@/services/edteMember.service'

// Integrantes del EDTE (CRM-071): valida con Zod y le pasa los datos al service

export async function listEdteMembers(req: Request, res: Response) {
  const query = listEdteMembersQuerySchema.parse(req.query)
  res.json(await edteMemberService.listEdteMembers(query))
}

export async function createEdteMember(req: Request, res: Response) {
  const input = createEdteMemberSchema.parse(req.body)
  res.status(201).json(await edteMemberService.createEdteMember(input))
}

export async function updateEdteMember(req: Request, res: Response) {
  const { id } = edteMemberIdParamSchema.parse(req.params)
  const input = updateEdteMemberSchema.parse(req.body)
  res.json(await edteMemberService.updateEdteMember(id, input))
}

export async function deactivateEdteMember(req: Request, res: Response) {
  const { id } = edteMemberIdParamSchema.parse(req.params)
  res.json(await edteMemberService.deactivateEdteMember(id))
}
