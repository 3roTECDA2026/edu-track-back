import { Prisma, UserStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateEdteMemberInput,
  ListEdteMembersQuery,
  UpdateEdteMemberInput,
} from '@/schemas/edteMember.schema'
import { HttpError } from '@/utils/httpError'

// Integrantes del Equipo de Definición de Trayectorias Educativas (E4-RF-01, CRM-071).
// Hay una sola fila por usuario: la baja es lógica (active = false) y un alta posterior
// reactiva esa misma fila, así nadie queda dos veces como integrante activo.

const memberInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
} satisfies Prisma.EdteTeamMemberInclude

const fullName = (user: { firstName: string; lastName: string }) =>
  `${user.lastName}, ${user.firstName}`

async function findMemberOrFail(id: string) {
  const member = await prisma.edteTeamMember.findUnique({ where: { id }, include: memberInclude })
  if (!member) throw new HttpError(404, 'Integrante del EDTE no encontrado')
  return member
}

// Lista los integrantes: por defecto, solo los activos
export async function listEdteMembers(query: ListEdteMembersQuery) {
  return prisma.edteTeamMember.findMany({
    where: query.status === 'all' ? {} : { active: query.status === 'active' },
    include: memberInclude,
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  })
}

// Alta de un integrante. Si ya fue integrante y estaba dado de baja, se lo reactiva
export async function createEdteMember(input: CreateEdteMemberInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, firstName: true, lastName: true, status: true },
  })
  if (!user) throw new HttpError(404, 'Usuario no encontrado')
  if (user.status !== UserStatus.ACTIVE) {
    throw new HttpError(409, `${fullName(user)} no es un usuario activo: no puede integrar el EDTE`)
  }

  const existing = await prisma.edteTeamMember.findUnique({ where: { userId: input.userId } })
  if (existing?.active) {
    throw new HttpError(409, `${fullName(user)} ya integra el EDTE`)
  }

  // Estaba dado de baja: se reactiva la misma fila, con el rol nuevo y una nueva fecha de alta
  if (existing) {
    return prisma.edteTeamMember.update({
      where: { id: existing.id },
      data: { active: true, edteRole: input.edteRole, joinedAt: new Date() },
      include: memberInclude,
    })
  }

  try {
    return await prisma.edteTeamMember.create({
      data: { userId: input.userId, edteRole: input.edteRole },
      include: memberInclude,
    })
  } catch (err) {
    // La base no permite dos filas para el mismo usuario (por ejemplo, un doble clic)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, `${fullName(user)} ya integra el EDTE`)
    }
    throw err
  }
}

// Cambia el rol de un integrante activo
export async function updateEdteMember(id: string, input: UpdateEdteMemberInput) {
  const member = await findMemberOrFail(id)
  if (!member.active) {
    throw new HttpError(
      409,
      `${fullName(member.user)} está dado de baja: para cambiarle el rol, volvé a darlo de alta`
    )
  }
  return prisma.edteTeamMember.update({
    where: { id },
    data: { edteRole: input.edteRole },
    include: memberInclude,
  })
}

// Baja lógica: el integrante deja de estar activo, pero no se borra
export async function deactivateEdteMember(id: string) {
  const member = await findMemberOrFail(id)
  if (!member.active) {
    throw new HttpError(409, `${fullName(member.user)} ya está dado de baja`)
  }
  return prisma.edteTeamMember.update({
    where: { id },
    data: { active: false },
    include: memberInclude,
  })
}
