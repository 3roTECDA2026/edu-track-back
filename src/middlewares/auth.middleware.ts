
import { Role, UserStatus } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { asyncHandler } from '@/utils/asyncHandler'

const tokenPayloadSchema = z.object({
  userId: z.uuid(),
  role: z.enum(Role),
  name: z.string(),
})

export type AuthUser = z.infer<typeof tokenPayloadSchema>

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
  }
}

// Obtener clave JWT de forma segura
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new HttpError(500, 'JWT_SECRET no está configurado')
  }

  return secret
}

// Middleware de autenticación
export const verifyToken = asyncHandler(
  async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authorization = req.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Token de autenticación requerido')
    }

    const token = authorization.slice(7)

    let decoded: unknown

    try {
      decoded = jwt.verify(token, getJwtSecret())
    } catch (error) {
      if (error instanceof HttpError) {
        throw error
      }

      throw new HttpError(401, 'Token inválido o expirado')
    }

    const parsed = tokenPayloadSchema.safeParse(decoded)

    if (!parsed.success) {
      throw new HttpError(401, 'Token inválido')
    }

    // Consultar rol y estado actual en la base de datos
    const dbUser = await prisma.user.findUnique({
      where: {
        id: parsed.data.userId,
      },
      select: {
        role: true,
        status: true,
      },
    })

    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
      throw new HttpError(401, 'Usuario inexistente o suspendido')
    }

    req.user = {
      ...parsed.data,
      role: dbUser.role,
    }

    next()
  }
)

// Middleware de autorización por roles
export const requireRole =
  (...roles: Role[]) =>
  (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      next(new HttpError(401, 'No autenticado'))
      return
    }

    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'Acceso denegado'))
      return
    }

    next()
  }

// Obtener usuario autenticado
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, 'No autenticado')
  }

  return req.user
}
