import type { Request, Response } from 'express'

import {
  addScheduleSubjectSchema,
  createScheduleSchema,
  listSchedulesQuerySchema,
  scheduleIdParamSchema,
  scheduleSubjectParamSchema,
  updateScheduleSchema,
  updateScheduleSubjectSchema,
} from '@/schemas/intensificationSchedule.schema'
import * as scheduleService from '@/services/intensificationSchedule.service'

export async function listSchedules(req: Request, res: Response) {
  const { year } = listSchedulesQuerySchema.parse(req.query)
  res.json(await scheduleService.listSchedules(year))
}

export async function createSchedule(req: Request, res: Response) {
  const input = createScheduleSchema.parse(req.body)
  res.status(201).json(await scheduleService.createSchedule(input))
}

export async function updateSchedule(req: Request, res: Response) {
  const { id } = scheduleIdParamSchema.parse(req.params)
  const input = updateScheduleSchema.parse(req.body)
  res.json(await scheduleService.updateSchedule(id, input))
}

export async function deleteSchedule(req: Request, res: Response) {
  const { id } = scheduleIdParamSchema.parse(req.params)
  await scheduleService.deleteSchedule(id)
  res.json({ deleted: true })
}

export async function addScheduleSubject(req: Request, res: Response) {
  const { id } = scheduleIdParamSchema.parse(req.params)
  const input = addScheduleSubjectSchema.parse(req.body)
  res.status(201).json(await scheduleService.addScheduleSubject(id, input))
}

export async function updateScheduleSubject(req: Request, res: Response) {
  const { id, entryId } = scheduleSubjectParamSchema.parse(req.params)
  const input = updateScheduleSubjectSchema.parse(req.body)
  res.json(await scheduleService.updateScheduleSubject(id, entryId, input))
}

export async function removeScheduleSubject(req: Request, res: Response) {
  const { id, entryId } = scheduleSubjectParamSchema.parse(req.params)
  res.json(await scheduleService.removeScheduleSubject(id, entryId))
}

export async function listScheduleTeachers(_req: Request, res: Response) {
  res.json(await scheduleService.listScheduleTeachers())
}
