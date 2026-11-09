import { prisma } from '@/lib/prisma'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { getAuthUser } from '@/middlewares/auth.middleware'
import {
  createLegalConflict,
  getLegalConflictById,
  getLegalConflictsByStudent,
  updateLegalConflict,
  deleteLegalConflict,
} from '@/services/legalConflict.service'
import { HttpError } from '@/utils/httpError'

const idSchema = z.guid()

const createConflictSchema = z.object({
  studentId: z.guid(),
  conflictCode: z.string().trim().min(1),
  detailedReport: z.string().trim().min(1),
  occurrenceDate: z.coerce.date().optional(),
}).strict()

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  const data = createConflictSchema.parse(req.body)
  const { userId } = getAuthUser(req)

  const conflict = await createLegalConflict({
    ...data,
    authorId: userId,
  })

  res.status(201).json({
    success: true,
    data: conflict,
  })
}

export const getById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = idSchema.parse(req.params.id)
  const conflict = await getLegalConflictById(id)

  if (!conflict) {
    throw new HttpError(404, 'Conflicto legal no encontrado')
  }

  res.status(200).json({
    success: true,
    data: conflict,
  })
}

export const listByStudent = async (
  req: Request,
  res: Response
): Promise<void> => {
  const studentId = idSchema.parse(req.params.studentId)
  const conflicts = await getLegalConflictsByStudent(studentId)

  res.status(200).json({
    success: true,
    data: conflicts,
  })
}

// CRM-090: operaciones permitidas solamente antes de firmar.

export const update = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = idSchema.parse(req.params.id)

  const data = z.object({
    conflictCode: z.string().trim().min(1).optional(),
    detailedReport: z.string().trim().min(1).optional(),
    occurrenceDate: z.union([
      z.coerce.date(),
      z.null(),
    ]).optional(),
  }).strict().refine(
    (value) => Object.keys(value).length > 0,
    'Debés indicar al menos un campo para actualizar'
  ).parse(req.body)

  const { userId } = getAuthUser(req)

  const conflict = await updateLegalConflict(id, data, {
    userId,
    ipAddress: req.ip ?? 'unknown',
  })

  res.status(200).json({
    success: true,
    data: conflict,
  })
}

export const remove = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = idSchema.parse(req.params.id)

  const { userId } = getAuthUser(req)

  await deleteLegalConflict(id, {
    userId,
    ipAddress: req.ip ?? 'unknown',
  })

  res.status(200).json({
    success: true,
    message: 'Acta de conflicto eliminada correctamente',
  })
}


// CRM-090 / CRM-091: catálogo de códigos normalizados
export const listCodes = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const codes = await prisma.conflictCode.findMany({
    select: {
      code: true,
      description: true,
    },
    orderBy: {
      code: 'asc',
    },
  })

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    success: true,
    data: codes,
  })
}
