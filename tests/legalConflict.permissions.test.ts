import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Role } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'

import { requireRole } from '../src/middlewares/auth.middleware'

const allowedRoles = [
  Role.EOE_DIRECTIVE,
  Role.SCHOOL_MANAGEMENT
]

const deniedRoles = [
  Role.ADMINISTRATOR,
  Role.TEACHER,
  Role.PRECEPTOR,
  Role.STUDENT,
  Role.FAMILY
]

function checkAccess(role: Role | null) {
  const req = {
    user: role
      ? {
          userId: '00000000-0000-4000-8000-000000000001',
          name: 'Usuario de prueba',
          role
        }
      : undefined
  } as Request

  let allowed = false
  let errorStatus: number | null = null

  const next: NextFunction = (error?: unknown) => {
    if (error) {
      const err = error as {
        statusCode?: number
        status?: number
      }

      errorStatus = err.statusCode ?? err.status ?? null
    } else {
      allowed = true
    }
  }

  requireRole(
    Role.EOE_DIRECTIVE,
    Role.SCHOOL_MANAGEMENT
  )(req, {} as Response, next)

  return { allowed, errorStatus }
}

for (const role of allowedRoles) {
  test(`CRM-090 permite acceso a ${role}`, () => {
    const result = checkAccess(role)

    assert.equal(result.allowed, true)
    assert.equal(result.errorStatus, null)
  })
}

for (const role of deniedRoles) {
  test(`CRM-090 rechaza acceso a ${role}`, () => {
    const result = checkAccess(role)

    assert.equal(result.allowed, false)
    assert.equal(result.errorStatus, 403)
  })
}

test('CRM-090 rechaza usuarios no autenticados', () => {
  const result = checkAccess(null)

  assert.equal(result.allowed, false)
  assert.equal(result.errorStatus, 401)
})
