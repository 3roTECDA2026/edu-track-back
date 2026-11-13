import { Role } from '@prisma/client'
import { Router } from 'express'

import * as interventionController from '@/controllers/intervention.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { uploadAttachments } from '@/middlewares/uploadAttachments'
import { asyncHandler } from '@/utils/asyncHandler'

export const interventionRouter = Router()

// Roles que pueden trabajar con intervenciones (criterio 3): preceptor, docente, EOE/dirección + admin.
const INTERVENTION_ROLES: Role[] = [
  Role.PRECEPTOR,
  Role.TEACHER,
  Role.EOE_DIRECTIVE,
  Role.SCHOOL_MANAGEMENT,
  Role.ADMINISTRATOR,
]

// Listar (por alumno/curso, con filtros)
interventionRouter.get(
  '/',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.listInterventions)
)

// Detalle
interventionRouter.get(
  '/:id',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.getInterventionById)
)

// Crear
interventionRouter.post(
  '/',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.createIntervention)
)

// Editar (el service valida que sea el autor y la ventana de 48 hs)
interventionRouter.put(
  '/:id',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.updateIntervention)
)

// ---- Adjuntos (CRM-087) ----

// Subir uno o varios archivos (multipart, campo "files"). verifyToken va antes que multer:
// así no se leen archivos de alguien sin sesión.
interventionRouter.post(
  '/:id/attachments',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  uploadAttachments,
  asyncHandler(interventionController.uploadInterventionAttachments)
)

// Listar los adjuntos de una intervención
interventionRouter.get(
  '/:id/attachments',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.listInterventionAttachments)
)

// Descargar un adjunto (nunca por URL pública: siempre con token y permiso)
interventionRouter.get(
  '/:id/attachments/:attachmentId',
  verifyToken,
  requireRole(...INTERVENTION_ROLES),
  asyncHandler(interventionController.downloadInterventionAttachment)
)
