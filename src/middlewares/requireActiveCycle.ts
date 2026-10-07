import type { NextFunction, Request, Response } from 'express'

import { getActiveCycle } from '@/services/cycle.service'
import { HttpError } from '@/utils/httpError'

export interface ActiveCycleContext {
  id: string
  year: number
  isActive: boolean
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
}

declare global {
  namespace Express {
    interface Request {
      activeCycle?: ActiveCycleContext
    }
  }
}

export async function requireActiveCycle(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const activeCycle = await getActiveCycle()
    if (!activeCycle) throw new HttpError(409, 'No hay un ciclo lectivo activo.')
    req.activeCycle = activeCycle
    next()
  } catch (error) {
    next(error)
  }
}
