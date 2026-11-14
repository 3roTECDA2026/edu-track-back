import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  assignIntensificationsSchema,
  candidatesQuerySchema,
  intensificationAttachmentParamsSchema,
  intensificationIdParamSchema,
  listIntensificationsQuerySchema,
  registerResultSchema,
  updatePlacementSchema,
} from '@/schemas/intensification.schema'
import * as intensificationService from '@/services/intensification.service'
import * as attachmentService from '@/services/intensificationAttachment.service'

export async function listIntensifications(req: Request, res: Response) {
  const query = listIntensificationsQuerySchema.parse(req.query)
  res.json(await intensificationService.listIntensifications(query))
}

export async function listCandidates(req: Request, res: Response) {
  const query = candidatesQuerySchema.parse(req.query)
  res.json(await intensificationService.listCandidates(query))
}

export async function assignIntensifications(req: Request, res: Response) {
  const input = assignIntensificationsSchema.parse(req.body)
  res.status(201).json(await intensificationService.assignIntensifications(input))
}

export async function updatePlacement(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  const input = updatePlacementSchema.parse(req.body)
  res.json(await intensificationService.updatePlacement(id, input))
}

export async function removeIntensification(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  res.json(await intensificationService.removeIntensification(id))
}

// El usuario logueado decide si puede cargar el resultado (docente responsable o dirección)
export async function registerResult(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  const input = registerResultSchema.parse(req.body)
  const { userId, role } = getAuthUser(req)
  res.json(await intensificationService.registerResult(id, input, { userId, role }))
}

// ---- Evidencias del intento (CRM-060) ----

function getActor(req: Request) {
  const { userId, role } = getAuthUser(req)
  return { userId, role, ipAddress: req.ip ?? 'unknown' }
}

export async function uploadAttachments(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  // multer deja los archivos en req.files (array, porque usa upload.array)
  const files = Array.isArray(req.files) ? req.files : []
  res
    .status(201)
    .json(await attachmentService.uploadIntensificationAttachments(id, files, getActor(req)))
}

export async function listAttachments(req: Request, res: Response) {
  const { id } = intensificationIdParamSchema.parse(req.params)
  res.json(await attachmentService.listIntensificationAttachments(id))
}

// Devuelve el archivo en sí (no JSON). El front lo pide con fetch + token.
export async function downloadAttachment(req: Request, res: Response) {
  const { id, attachmentId } = intensificationAttachmentParamsSchema.parse(req.params)
  const { attachment, content } = await attachmentService.getIntensificationAttachmentFile(
    id,
    attachmentId
  )
  res.setHeader('Content-Type', attachment.mimeType)
  res.setHeader('Content-Length', content.length)
  // filename* con encodeURIComponent: así llegan bien los nombres con tildes y ñ
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
  )
  // Que el navegador no "adivine" otro tipo distinto del declarado
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.send(content)
}

export async function deleteAttachment(req: Request, res: Response) {
  const { id, attachmentId } = intensificationAttachmentParamsSchema.parse(req.params)
  res.json(await attachmentService.deleteIntensificationAttachment(id, attachmentId, getActor(req)))
}
