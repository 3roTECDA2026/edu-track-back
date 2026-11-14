import { Role } from '@prisma/client'
import { Router } from 'express'

import * as intensificationController from '@/controllers/intensification.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { uploadAttachments } from '@/middlewares/uploadAttachments'
import { ATTACHMENT_DELETE_ROLES } from '@/services/intensificationAttachment.service'
import { asyncHandler } from '@/utils/asyncHandler'

export const intensificationRouter = Router()

// Ver las asignaciones: personal de la escuela
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.PRECEPTOR,
  Role.TEACHER
)

// Asignar, cambiar el modelo o quitar: dirección o administración
const canEdit = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT)

// Cargar el resultado: dirección, administración o docentes
// (un docente solo el de sus alumnos: lo controla el service)
const canRegisterResult = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.TEACHER,
  Role.PRECEPTOR
)

intensificationRouter.use(verifyToken)

intensificationRouter.get(
  '/',
  canView,
  asyncHandler(intensificationController.listIntensifications)
)
intensificationRouter.get(
  '/candidates',
  canView,
  asyncHandler(intensificationController.listCandidates)
)
intensificationRouter.post(
  '/',
  canEdit,
  asyncHandler(intensificationController.assignIntensifications)
)
intensificationRouter.patch(
  '/:id/result',
  canRegisterResult,
  asyncHandler(intensificationController.registerResult)
)
intensificationRouter.patch(
  '/:id',
  canEdit,
  asyncHandler(intensificationController.updatePlacement)
)
intensificationRouter.delete(
  '/:id',
  canEdit,
  asyncHandler(intensificationController.removeIntensification)
)

// ---- Evidencias del intento (CRM-060) ----

// Subir (multipart, campo "files"): los mismos que cargan el resultado; el docente, solo en sus
// intentos (lo controla el service). multer va después de verifyToken y del rol: así no se leen
// archivos de alguien sin permiso.
intensificationRouter.post(
  '/:id/attachments',
  canRegisterResult,
  uploadAttachments,
  asyncHandler(intensificationController.uploadAttachments)
)
intensificationRouter.get(
  '/:id/attachments',
  canView,
  asyncHandler(intensificationController.listAttachments)
)
// Descargar: nunca por URL pública, siempre con token
intensificationRouter.get(
  '/:id/attachments/:attachmentId',
  canView,
  asyncHandler(intensificationController.downloadAttachment)
)
// Baja lógica: por ahora solo dirección (ATTACHMENT_DELETE_ROLES)
intensificationRouter.delete(
  '/:id/attachments/:attachmentId',
  requireRole(...ATTACHMENT_DELETE_ROLES),
  asyncHandler(intensificationController.deleteAttachment)
)
