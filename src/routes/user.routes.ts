
import { Router } from 'express'
import { Prisma, Role, UserStatus } from '@prisma/client'
import bcrypt from 'bcrypt'

import { prisma } from '@/lib/prisma'
import { requireAuth, requireRole } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'
import { HttpError } from '@/utils/httpError'

const router = Router()

// =====================================================
// SEGURIDAD
// Solo los administradores pueden gestionar usuarios.
// =====================================================

router.use(requireAuth, requireRole(Role.ADMINISTRATOR))

// =====================================================
// ROLES
// Conversión entre frontend y Prisma.
// =====================================================

const frontendRoles = {
  ADMINISTRATOR: 'admin',
  TEACHER: 'docente',
  PRECEPTOR: 'preceptor',
} as const

const backendRoles = {
  admin: Role.ADMINISTRATOR,
  docente: Role.TEACHER,
  preceptor: Role.PRECEPTOR,
} as const

type FrontendRole = keyof typeof backendRoles

// =====================================================
// TIPOS
// =====================================================

type UserInput = {
  firstName?: unknown
  lastName?: unknown
  dni?: unknown
  email?: unknown
  phone?: unknown
  username?: unknown
  role?: unknown
  active?: unknown
  courseIds?: unknown
  password?: unknown
}

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
} satisfies Prisma.UserSelect

// =====================================================
// CONVERSIÓN DE USUARIO PARA REACT
// =====================================================

function toFrontendUser(user: {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
  status: UserStatus
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,

    role:
      frontendRoles[user.role as keyof typeof frontendRoles] ??
      user.role.toLowerCase(),

    active: user.status === UserStatus.ACTIVE,

    // Campos que todavía no existen en el modelo User.
    dni: '',
    phone: null,
    username: user.email,
    courseIds: [] as number[],
  }
}

// =====================================================
// VALIDACIÓN DE DATOS
// =====================================================

function validateInput(body: UserInput, creating: boolean) {
  const firstName =
    typeof body.firstName === 'string'
      ? body.firstName.trim()
      : ''

  const lastName =
    typeof body.lastName === 'string'
      ? body.lastName.trim()
      : ''

  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''

  if (!firstName || !lastName || !email) {
    throw new HttpError(
      400,
      'Nombre, apellido y correo son obligatorios',
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(
      400,
      'Correo electrónico inválido',
    )
  }

  if (
    typeof body.role !== 'string' ||
    !(body.role in backendRoles)
  ) {
    throw new HttpError(
      400,
      'Rol no admitido. Se permiten administrador, docente y preceptor',
    )
  }

  // La asignación de cursos todavía no está integrada.
  if (
    body.courseIds !== undefined &&
    (!Array.isArray(body.courseIds) ||
      body.courseIds.length > 0)
  ) {
    throw new HttpError(
      400,
      'La asignación de cursos todavía no está integrada',
    )
  }

  // Estos campos no están disponibles en Prisma User.
  if (
    (typeof body.dni === 'string' && body.dni.trim()) ||
    (typeof body.phone === 'string' && body.phone.trim()) ||
    (typeof body.username === 'string' &&
      body.username.trim() &&
      body.username.trim() !== email)
  ) {
    throw new HttpError(
      400,
      'DNI, teléfono y nombre de usuario independiente todavía no están disponibles en la base de datos',
    )
  }

  const password =
    typeof body.password === 'string'
      ? body.password
      : ''

  if (
    (creating || password.length > 0) &&
    password.length < 8
  ) {
    throw new HttpError(
      400,
      'La contraseña debe tener al menos 8 caracteres',
    )
  }

  return {
    firstName,
    lastName,
    email,

    role: backendRoles[body.role as FrontendRole],

    status:
      body.active === false
        ? UserStatus.SUSPENDED
        : UserStatus.ACTIVE,

    password,
  }
}

// =====================================================
// GET /api/users
// LISTAR USUARIOS
// =====================================================

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 10)

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new HttpError(400, 'Paginación inválida')
    }

    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : ''

    const role = req.query.role
    const active = req.query.active

    // Incluimos los tres roles en el listado.
    const where: Prisma.UserWhereInput = {
      role: {
        in: [
          Role.ADMINISTRATOR,
          Role.TEACHER,
          Role.PRECEPTOR,
        ],
      },
    }

    // Filtrar por rol.
    if (role !== undefined && role !== '') {
      if (
        typeof role !== 'string' ||
        !(role in backendRoles)
      ) {
        throw new HttpError(
          400,
          'Filtro de rol no admitido',
        )
      }

      where.role = backendRoles[role as FrontendRole]
    }

    // Filtrar por estado.
    if (active !== undefined && active !== '') {
      if (active !== 'true' && active !== 'false') {
        throw new HttpError(
          400,
          'Filtro de estado inválido',
        )
      }

      where.status =
        active === 'true'
          ? UserStatus.ACTIVE
          : { not: UserStatus.ACTIVE }
    }

    // Buscar por nombre, apellido o email.
    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ]
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.user.count({ where }),
    ])

    res.json({
      success: true,
      data: users.map(toFrontendUser),
      pagination: {
        page,
        limit,
        total,
      },
    })
  }),
)

// =====================================================
// GET /api/users/:id
// OBTENER UN USUARIO
// =====================================================

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)

    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    })

    if (!user) {
      throw new HttpError(
        404,
        'Usuario no encontrado',
      )
    }

    res.json({
      success: true,
      data: toFrontendUser(user),
    })
  }),
)

// =====================================================
// POST /api/users
// CREAR USUARIO
// =====================================================

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = validateInput(req.body ?? {}, true)

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    })

    if (existing) {
      throw new HttpError(
        409,
        'El correo ya está registrado',
      )
    }

    const user = await prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        status: input.status,

        passwordHash: await bcrypt.hash(
          input.password,
          12,
        ),
      },
      select: userSelect,
    })

    res.status(201).json({
      success: true,
      data: toFrontendUser(user),
    })
  }),
)

// =====================================================
// PUT /api/users/:id
// ACTUALIZAR USUARIO
// =====================================================

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = validateInput(req.body ?? {}, false)
    const id = String(req.params.id)

    const existing = await prisma.user.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new HttpError(
        404,
        'Usuario no encontrado',
      )
    }

    // Impedir que un administrador se quite
    // sus propios permisos o suspenda su cuenta.
    if (
      existing.id === res.locals.authUser.id &&
      (
        input.role !== Role.ADMINISTRATOR ||
        input.status !== UserStatus.ACTIVE
      )
    ) {
      throw new HttpError(
        400,
        'No podés quitarte tus propios permisos de administrador',
      )
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        status: input.status,

        ...(input.password
          ? {
              passwordHash: await bcrypt.hash(
                input.password,
                12,
              ),
            }
          : {}),
      },
      select: userSelect,
    })

    res.json({
      success: true,
      data: toFrontendUser(user),
    })
  }),
)

// =====================================================
// PATCH /api/users/:id/suspend
// SUSPENDER USUARIO
// =====================================================

router.patch(
  '/:id/suspend',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)

    if (id === res.locals.authUser.id) {
      throw new HttpError(
        400,
        'No podés suspender tu propia cuenta',
      )
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new HttpError(
        404,
        'Usuario no encontrado',
      )
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.SUSPENDED,
      },
      select: userSelect,
    })

    res.json({
      success: true,
      data: toFrontendUser(user),
    })
  }),
)

// =====================================================
// PATCH /api/users/:id/activate
// REACTIVAR USUARIO
// =====================================================

router.patch(
  '/:id/activate',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id)

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new HttpError(
        404,
        'Usuario no encontrado',
      )
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
      },
      select: userSelect,
    })

    res.json({
      success: true,
      data: toFrontendUser(user),
    })
  }),
)

export default router
