import { Role } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'

import { HttpError } from '@/utils/httpError'

// Roles que acceden al dashboard del EDTE (CRM-077, criterio 5): EOE/directivos y dirección.
export const EDTE_DASHBOARD_ROLES: Role[] = [Role.EOE_DIRECTIVE, Role.SCHOOL_MANAGEMENT]

// Acceso al dashboard del EDTE. Va después de verifyToken.
// Provisorio hasta CRM-071 (PR #58): por ahora solo por rol. Cuando esté el plantel del EDTE,
// también pasa cualquier usuario que sea integrante activo (EdteTeamMember), aunque su rol sea
// TEACHER o PRECEPTOR.
export function requireEdteAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new HttpError(401, 'No autenticado'))
    return
  }
  if (!EDTE_DASHBOARD_ROLES.includes(req.user.role)) {
    next(new HttpError(403, 'Acceso denegado'))
    return
  }
  next()
}
