import { Prisma, UserStatus } from '@prisma/client'
import bcrypt from 'bcrypt'

import { prisma } from '@/lib/prisma'
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from '@/schemas/user.schema'
import { HttpError } from '@/utils/httpError'

const SALT_ROUNDS = 10

// Nunca se expone passwordHash
const userPublicSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  mfaEnabled: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

export type PublicUser = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>

function buildUserWhere(query: ListUsersQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {}

  if (query.role) {
    where.role = query.role
  }

  if (query.status) {
    where.status = query.status
  } else if (query.active !== undefined) {
    where.status = query.active ? UserStatus.ACTIVE : { not: UserStatus.ACTIVE }
  }

  // Cada palabra debe coincidir con nombre, apellido o email ("juan perez" funciona)
  if (query.search) {
    const terms = query.search.split(/\s+/)
    where.AND = terms.map(
      (term: string): Prisma.UserWhereInput => ({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      })
    )
  }

  return where
}

async function findUserOrThrow(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, select: userPublicSelect })
  if (!user) {
    throw new HttpError(404, 'Usuario no encontrado')
  }
  return user
}

async function assertEmailAvailable(email: string, excludeId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing && existing.id !== excludeId) {
    throw new HttpError(409, 'Ya existe un usuario con ese email')
  }
}

export async function listUsers(query: ListUsersQuery) {
  const where = buildUserWhere(query)

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userPublicSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ])

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  }
}

export async function getUser(id: string): Promise<PublicUser> {
  return findUserOrThrow(id)
}

export async function createUser(data: CreateUserInput): Promise<PublicUser> {
  const { password, ...rest } = data
  await assertEmailAvailable(rest.email)

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  return prisma.user.create({
    data: { ...rest, passwordHash },
    select: userPublicSelect,
  })
}

export async function updateUser(id: string, data: UpdateUserInput): Promise<PublicUser> {
  await findUserOrThrow(id)
  if (data.email) {
    await assertEmailAvailable(data.email, id)
  }

  return prisma.user.update({ where: { id }, data, select: userPublicSelect })
}

export async function suspendUser(id: string, currentUserId: string): Promise<PublicUser> {
  if (id === currentUserId) {
    throw new HttpError(400, 'No podés suspender tu propio usuario')
  }

  const user = await findUserOrThrow(id)
  if (user.status === UserStatus.SUSPENDED) {
    throw new HttpError(409, 'El usuario ya está suspendido')
  }

  // Baja lógica: no se elimina el registro
  return prisma.user.update({
    where: { id },
    data: { status: UserStatus.SUSPENDED },
    select: userPublicSelect,
  })
}

export async function activateUser(id: string): Promise<PublicUser> {
  const user = await findUserOrThrow(id)
  if (user.status === UserStatus.ACTIVE) {
    throw new HttpError(409, 'El usuario ya está activo')
  }

  return prisma.user.update({
    where: { id },
    data: { status: UserStatus.ACTIVE },
    select: userPublicSelect,
  })
}
