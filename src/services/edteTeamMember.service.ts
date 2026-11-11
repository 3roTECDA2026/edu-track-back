import { Prisma, Role, Shift, UserStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateEdteTeamMemberInput,
  ListEdteTeamMembersQuery,
  UpdateEdteTeamMemberInput,
} from '@/schemas/edteTeamMember.schema'
import { HttpError } from '@/utils/httpError'

// Integrantes del Equipo de Definición de Trayectorias Educativas (E4-RF-01, CRM-071).
// Hay un EDTE por turno (Anexo 2, inc. 22): una fila por usuario y turno. La baja es lógica
// (active = false) y un alta posterior reactiva la misma fila, así nadie queda dos veces activo
// en el EDTE de un mismo turno.

// Quiénes pueden integrar el EDTE: el personal de la escuela (no alumnos ni familias)
const MEMBER_ROLES: Role[] = [
  Role.TEACHER,
  Role.PRECEPTOR,
  Role.EOE_DIRECTIVE,
  Role.SCHOOL_MANAGEMENT,
]

const SHIFT_NAMES: Record<Shift, string> = {
  MORNING: 'mañana',
  AFTERNOON: 'tarde',
  EVENING: 'vespertino',
  EXTRA_TIME: 'contraturno',
}

// Solo los datos necesarios del usuario (sin el email)
const memberInclude = {
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
} satisfies Prisma.EdteTeamMemberInclude

type MemberWithUser = Prisma.EdteTeamMemberGetPayload<{ include: typeof memberInclude }>

const fullName = (user: { firstName: string; lastName: string }) =>
  `${user.lastName}, ${user.firstName}`

function toMemberResponse(member: MemberWithUser) {
  return {
    id: member.id,
    user: { id: member.user.id, name: fullName(member.user), role: member.user.role },
    shift: member.shift,
    edteRole: member.edteRole,
    active: member.active,
    joinedAt: member.joinedAt,
  }
}

async function findMemberOrFail(id: string) {
  const member = await prisma.edteTeamMember.findUnique({ where: { id }, include: memberInclude })
  if (!member) throw new HttpError(404, 'Integrante del EDTE no encontrado')
  return member
}

// Lista los integrantes: por defecto, los activos; con shift, solo los de ese turno
export async function listEdteTeamMembers(query: ListEdteTeamMembersQuery) {
  const members = await prisma.edteTeamMember.findMany({
    where: {
      ...(query.status !== 'all' && { active: query.status === 'active' }),
      ...(query.shift && { shift: query.shift }),
    },
    include: memberInclude,
    orderBy: [{ shift: 'asc' }, { user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  })
  return members.map(toMemberResponse)
}

// Alta de un integrante en el EDTE de un turno. Si ya lo integró y estaba dado de baja, se reactiva
export async function createEdteTeamMember(input: CreateEdteTeamMemberInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, firstName: true, lastName: true, status: true, role: true },
  })
  if (!user) throw new HttpError(404, 'Usuario no encontrado')
  if (!MEMBER_ROLES.includes(user.role)) {
    throw new HttpError(
      409,
      `${fullName(user)} no es personal de la escuela: el EDTE lo integran docentes, preceptores, el EOE y la dirección`
    )
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new HttpError(409, `${fullName(user)} no es un usuario activo: no puede integrar el EDTE`)
  }

  const turno = SHIFT_NAMES[input.shift]
  const existing = await prisma.edteTeamMember.findUnique({
    where: { userId_shift: { userId: input.userId, shift: input.shift } },
  })
  if (existing?.active) {
    throw new HttpError(409, `${fullName(user)} ya integra el EDTE del turno ${turno}`)
  }

  // Estaba dado de baja en ese turno: se reactiva la misma fila, con el rol nuevo y una nueva
  // fecha de alta
  if (existing) {
    const member = await prisma.edteTeamMember.update({
      where: { id: existing.id },
      data: { active: true, edteRole: input.edteRole, joinedAt: new Date() },
      include: memberInclude,
    })
    return toMemberResponse(member)
  }

  try {
    const member = await prisma.edteTeamMember.create({
      data: { userId: input.userId, shift: input.shift, edteRole: input.edteRole },
      include: memberInclude,
    })
    return toMemberResponse(member)
  } catch (err) {
    // La base no permite dos filas para el mismo usuario y turno (por ejemplo, un doble clic)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, `${fullName(user)} ya integra el EDTE del turno ${turno}`)
    }
    throw err
  }
}

// Cambia el rol de un integrante activo
export async function updateEdteTeamMember(id: string, input: UpdateEdteTeamMemberInput) {
  const member = await findMemberOrFail(id)
  if (!member.active) {
    throw new HttpError(
      409,
      `${fullName(member.user)} está dado de baja: para cambiarle el rol, volvé a darlo de alta`
    )
  }
  const updated = await prisma.edteTeamMember.update({
    where: { id },
    data: { edteRole: input.edteRole },
    include: memberInclude,
  })
  return toMemberResponse(updated)
}

// Baja lógica: el integrante deja de estar activo, pero no se borra
export async function deactivateEdteTeamMember(id: string) {
  const member = await findMemberOrFail(id)
  if (!member.active) {
    throw new HttpError(409, `${fullName(member.user)} ya está dado de baja`)
  }
  const updated = await prisma.edteTeamMember.update({
    where: { id },
    data: { active: false },
    include: memberInclude,
  })
  return toMemberResponse(updated)
}
