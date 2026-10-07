import type { Request, Response } from 'express'

import { createAcademicYearSchema, updateAcademicYearSchema } from '@/schemas/academicYear.schema'
import {
  createAcademicYearService,
  getCurrentAcademicYearService,
  listAcademicYearsService,
  setAcademicYearActiveService,
  updateAcademicYearService,
} from '@/services/academicYear.service'
import { activateCycle } from '@/services/cycle.service'
import { HttpError } from '@/utils/httpError'

export const listAcademicYears = async (_req: Request, res: Response) => {
  const academicYears = await listAcademicYearsService()
  return res.status(200).json(academicYears)
}

export const getCurrentAcademicYear = async (_req: Request, res: Response) => {
  const academicYear = await getCurrentAcademicYearService()

  if (!academicYear) {
    return res.status(404).json({ error: 'No hay un ciclo lectivo activo.' })
  }

  return res.status(200).json(academicYear)
}

export const createAcademicYear = async (req: Request, res: Response) => {
  try {
    const data = createAcademicYearSchema.parse(req.body)
    const { active, ...cycleData } = data
    const created = await createAcademicYearService({ ...cycleData, active: false })
    const academicYear = active ? await activateCycle(created.id) : created
    return res.status(201).json(academicYear)
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ errors: (error as any).issues })
    }

    return res.status(500).json({ error: 'Error al crear el ciclo lectivo.' })
  }
}

export const activateAcademicYear = async (req: Request, res: Response) => {
  const id = req.params.id

  if (!id) {
    return res.status(400).json({ error: 'ID del ciclo lectivo requerido.' })
  }

  const academicYear = await activateCycle(id)
  return res.status(200).json(academicYear)
}

export const updateAcademicYear = async (req: Request, res: Response) => {
  const id = req.params.id

  if (!id) {
    return res.status(400).json({ error: 'ID del ciclo lectivo requerido.' })
  }

  try {
    const data = updateAcademicYearSchema.parse(req.body)
    const { active, ...cycleData } = data
    if (active === true) await activateCycle(id)

    const current = await getCurrentAcademicYearService()
    if (active === false && current?.id === id) {
      throw new HttpError(409, 'No se puede desactivar el ciclo activo sin activar otro ciclo.')
    }

    const updatedAcademicYear = await updateAcademicYearService(id, cycleData)
    return res.status(200).json(updatedAcademicYear)
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ errors: (error as any).issues })
    }

    return res.status(500).json({ error: 'Error al actualizar el ciclo lectivo.' })
  }
}
