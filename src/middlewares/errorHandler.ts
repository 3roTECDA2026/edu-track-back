import { Prisma } from '@prisma/client'
import type { ErrorRequestHandler } from 'express'
import { ZodError, z } from 'zod'

import { HttpError } from '@/utils/httpError'

// Must be registered LAST, after all routers.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ success: false, error: 'Validation error', details: z.flattenError(err) })
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'Resource already exists' })
      return
    }
    if (err.code === 'P2003') {
      res.status(409).json({ success: false, error: 'Related resource not found' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Resource not found' })
      return
    }
  }

  console.error(err)
  res.status(500).json({ success: false, error: 'Internal server error' })
}
