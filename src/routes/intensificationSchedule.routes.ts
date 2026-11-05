import { Role } from '@prisma/client'
import { Router } from 'express'

import * as scheduleController from '@/controllers/intensificationSchedule.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

export const intensificationScheduleRouter = Router()

// Armar el calendario es tarea de la dirección o de administración
const canEdit = requireRole(Role.SCHOOL_MANAGEMENT, Role.ADMINISTRATOR)

intensificationScheduleRouter.use(verifyToken)

intensificationScheduleRouter.get('/', asyncHandler(scheduleController.listSchedules))
intensificationScheduleRouter.get('/teachers', canEdit, asyncHandler(scheduleController.listScheduleTeachers))
intensificationScheduleRouter.post('/', canEdit, asyncHandler(scheduleController.createSchedule))
intensificationScheduleRouter.patch('/:id', canEdit, asyncHandler(scheduleController.updateSchedule))
intensificationScheduleRouter.delete('/:id', canEdit, asyncHandler(scheduleController.deleteSchedule))

intensificationScheduleRouter.post(
  '/:id/subjects',
  canEdit,
  asyncHandler(scheduleController.addScheduleSubject)
)
intensificationScheduleRouter.patch(
  '/:id/subjects/:entryId',
  canEdit,
  asyncHandler(scheduleController.updateScheduleSubject)
)
intensificationScheduleRouter.delete(
  '/:id/subjects/:entryId',
  canEdit,
  asyncHandler(scheduleController.removeScheduleSubject)
)