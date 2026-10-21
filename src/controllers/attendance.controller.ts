import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  attendanceIdParamSchema,
  attendanceSectionIdParamSchema,
  batchAttendanceSchema,
  justificationSchema,
  paginationAttendanceSchema,
  sectionAttendanceQuerySchema,
} from '@/schemas/attendance.schema'
import * as attendanceService from '@/services/attendance.service'

export async function saveBatch(req: Request, res: Response) {
  const input = batchAttendanceSchema.parse(req.body)
  const { userId } = getAuthUser(req)
  const result = await attendanceService.saveBatchAttendance({ ...input, registeredById: userId })
  return res.status(201).json(result)
}

export async function getSectionAttendance(req: Request, res: Response) {
  const { sectionId } = attendanceSectionIdParamSchema.parse(req.params)
  const { date } = sectionAttendanceQuerySchema.parse(req.query)
  const result = await attendanceService.getSectionAttendance(sectionId, date)
  return res.json(result)
}

export async function listAttendanceSections(_req: Request, res: Response) {
  return res.json(await attendanceService.listAttendanceSections())
}

export async function listAttendances(req: Request, res: Response) {
  const filters = paginationAttendanceSchema.parse(req.query)
  const result = await attendanceService.listAttendances(filters)
  return res.json(result)
}

export async function getSummary(req: Request, res: Response) {
  const filters = paginationAttendanceSchema.parse(req.query)
  const result = await attendanceService.getAttendanceSummary(filters)
  return res.json(result)
}

export async function justify(req: Request, res: Response) {
  const { id } = attendanceIdParamSchema.parse(req.params)
  const { justification } = justificationSchema.parse(req.body)
  const result = await attendanceService.justifyAttendance(id, justification)
  return res.json(result)
}
