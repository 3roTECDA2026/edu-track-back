import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createInterventionSchema,
  interventionAttachmentParamsSchema,
  interventionIdParamSchema,
  listInterventionsQuerySchema,
  updateInterventionSchema,
} from '@/schemas/intervention.schema'
import * as interventionService from '@/services/intervention.service'
import * as attachmentService from '@/services/interventionAttachment.service'
import { sendSuccess } from '@/utils/apiResponse'

// Arma el "actor" (quién hace la acción) a partir del token y la request.
function getActor(req: Request) {
  const user = getAuthUser(req)
  return { userId: user.userId, role: user.role, ipAddress: req.ip ?? 'unknown' }
}

export async function createIntervention(req: Request, res: Response) {
  const data = createInterventionSchema.parse(req.body)
  const intervention = await interventionService.createIntervention(data, getActor(req))
  sendSuccess(res, intervention, 'Intervención registrada correctamente', 201)
}

export async function listInterventions(req: Request, res: Response) {
  const query = listInterventionsQuerySchema.parse(req.query)
  const result = await interventionService.listInterventions(query, getActor(req))
  sendSuccess(res, result, 'Intervenciones obtenidas correctamente')
}

export async function getInterventionById(req: Request, res: Response) {
  const { id } = interventionIdParamSchema.parse(req.params)
  const intervention = await interventionService.getInterventionById(id, getActor(req))
  sendSuccess(res, intervention, 'Intervención obtenida correctamente')
}

export async function updateIntervention(req: Request, res: Response) {
  const { id } = interventionIdParamSchema.parse(req.params)
  const data = updateInterventionSchema.parse(req.body)
  const intervention = await interventionService.updateIntervention(id, data, getActor(req))
  sendSuccess(res, intervention, 'Intervención actualizada correctamente')
}

// ---- Adjuntos (CRM-087) ----

export async function uploadInterventionAttachments(req: Request, res: Response) {
  const { id } = interventionIdParamSchema.parse(req.params)
  // multer deja los archivos en req.files (array, porque usamos upload.array)
  const files = Array.isArray(req.files) ? req.files : []
  const attachments = await attachmentService.uploadAttachments(id, files, getActor(req))
  sendSuccess(res, attachments, 'Archivos adjuntados correctamente', 201)
}

export async function listInterventionAttachments(req: Request, res: Response) {
  const { id } = interventionIdParamSchema.parse(req.params)
  const attachments = await attachmentService.listAttachments(id, getActor(req))
  sendSuccess(res, attachments, 'Adjuntos obtenidos correctamente')
}

// Devuelve el archivo en sí (no JSON). El front lo pide con fetch + token y lo descarga.
export async function downloadInterventionAttachment(req: Request, res: Response) {
  const { id, attachmentId } = interventionAttachmentParamsSchema.parse(req.params)
  const { attachment, content } = await attachmentService.getAttachmentFile(
    id,
    attachmentId,
    getActor(req)
  )
  res.setHeader('Content-Type', attachment.mimeType)
  res.setHeader('Content-Length', content.length)
  // filename* con encodeURIComponent: así llegan bien los nombres con tildes y ñ
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
  )
  // Que el navegador no "adivine" otro tipo distinto del que declaramos
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.send(content)
}
