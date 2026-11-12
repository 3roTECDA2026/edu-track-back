import type { Request, Response } from 'express'

import {
  listPendingSubjectsQuerySchema,
  pendingSubjectIdParamSchema,
  updatePendingKnowledgeSchema,
} from '@/schemas/pendingSubject.schema'
import * as pendingSubjectService from '@/services/pendingSubject.service'
import { sendSuccess } from '@/utils/apiResponse'

// Saberes pendientes por materia (CRM-053): valida con Zod y le pasa los datos al service

export async function listPendingSubjects(req: Request, res: Response) {
  const query = listPendingSubjectsQuerySchema.parse(req.query)
  const items = await pendingSubjectService.listPendingSubjects(query)
  sendSuccess(res, items, 'Materias pendientes del alumno')
}

export async function updatePendingKnowledge(req: Request, res: Response) {
  const { id } = pendingSubjectIdParamSchema.parse(req.params)
  const input = updatePendingKnowledgeSchema.parse(req.body)
  const item = await pendingSubjectService.updatePendingKnowledge(id, input)
  sendSuccess(res, item, 'Saberes pendientes guardados')
}
