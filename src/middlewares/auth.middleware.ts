import type { NextFunction, Request, Response } from 'express'
import { Role } from '@prisma/client'
import jwt, { type JwtPayload } from 'jsonwebtoken'

import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

interface AuthPayload extends JwtPayload {
  userId: string
  role: Role
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = req.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Token de autenticación requerido')
    }

    const token = authorization.slice(7)

    if (!process.env.JWT_SECRET) {
      throw new HttpError(500, 'JWT_SECRET no está configurado')
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as AuthPayload

    if (!decoded.userId || typeof decoded.userId !== 'string') {
      throw new HttpError(401, 'Token inválido')
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(403, 'Usuario inactivo o suspendido')
    }

    res.locals.authUser = {
      id: user.id,
      role: user.role,
    }

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new HttpError(401, 'Token inválido o expirado'))
      return
    }

    next(error)
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.authUser as { id: string; role: Role } | undefined

    if (!user) {
      next(new HttpError(401, 'Usuario no autenticado'))
      return
    }

    if (!allowedRoles.includes(user.role)) {
      next(new HttpError(403, 'No tenés permisos para esta operación'))
      return
    }

    next()
  }
}
