import type { Request, Response } from 'express'

import { createCycleSchema } from '@/schemas/academicYear.schema'
import * as cycleService from '@/services/cycle.service'
import { HttpError } from '@/utils/httpError'

export async function listCycles(_req: Request, res: Response) {
  res.json(await cycleService.listCycles())
}

export async function getActiveCycle(_req: Request, res: Response) {
  const cycle = await cycleService.getActiveCycle()
  if (!cycle) throw new HttpError(404, 'No hay un ciclo lectivo activo.')
  res.json(cycle)
}

export async function createCycle(req: Request, res: Response) {
  const input = createCycleSchema.parse(req.body)
  res.status(201).json(await cycleService.createCycle(input))
}

export async function activateCycle(req: Request, res: Response) {
  const { id } = req.params
  if (!id) throw new HttpError(400, 'Se requiere el ID del ciclo lectivo.')
  res.json(await cycleService.activateCycle(id))
}
