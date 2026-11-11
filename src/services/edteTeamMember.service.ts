import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

export async function listEdteTeamMembers() {
  return prisma.edteTeamMember.findMany({
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createEdteTeamMember(input: { userId: string; roleInTeam: string; active?: boolean }) {
  const existing = await prisma.edteTeamMember.findUnique({ where: { userId: input.userId } })
  if (existing) throw new HttpError(409, 'El usuario ya es integrante del EDTE')
  return prisma.edteTeamMember.create({
    data: { userId: input.userId, roleInTeam: input.roleInTeam, active: input.active ?? true },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  })
}

export async function updateEdteTeamMember(id: string, input: { roleInTeam?: string; active?: boolean }) {
  return prisma.edteTeamMember.update({
    where: { id },
    data: input,
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  })
}

export async function deactivateEdteTeamMember(id: string) {
  return prisma.edteTeamMember.update({ where: { id }, data: { active: false } })
}
