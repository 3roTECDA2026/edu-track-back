import { Role, UserStatus } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '@/utils/httpError'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { asyncHandler } from '@/utils/asyncHandler'

// z.guid() acepta también los ids fijos del seed (00000000-...), que z.uuid() rechaza en Zod 4.
const tokenPayloadSchema = z.object({
  userId: z.guid(),
  role: z.enum(Role),
  name: z.string(),
})

export type AuthUser = z.infer<typeof tokenPayloadSchema>

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
  }
}

// La clave de los tokens tiene que venir del .env. Sin ella no se puede firmar ni verificar
// una sesión: nunca se usa una clave escrita en el código (el repositorio es público).
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Falta la variable de entorno JWT_SECRET en el .env')
  return secret
}

// Autenticación: ¿quién sos? -> 401
export const verifyToken = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      throw new HttpError(401, 'Token no provisto')
    }

    let decoded: unknown
    try {
      decoded = jwt.verify(token, getJwtSecret())
    } catch {
      throw new HttpError(401, 'Token inválido o expirado')
    }

    const parsed = tokenPayloadSchema.safeParse(decoded)
    if (!parsed.success) {
      throw new HttpError(401, 'Token inválido')
    }

    // El rol y el estado se toman de la BD, no del token
    const dbUser = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { role: true, status: true },
    })
    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
      throw new HttpError(401, 'Usuario inexistente o suspendido')
    }

    req.user = { ...parsed.data, role: dbUser.role }
    next()
  }
)

// Autorización: ¿qué podés hacer? -> 403
// Uso: requireRole(Role.ADMINISTRATOR) o requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT)
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
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

export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, 'No autenticado')
  }
  return req.user
}
