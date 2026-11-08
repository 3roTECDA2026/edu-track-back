import { FortePlanStatus, Prisma, Role, StudentStatus, UserStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateFortePlanInput,
  CreateFortePlanReportInput,
  ListFortePlansQuery,
  UpdateFortePlanInput,
} from '@/schemas/fortePlan.schema'
import { HttpError } from '@/utils/httpError'

// Plan Forte (E4-RF-14, CRM-089): asignación de alumnos al programa y reportes de evolución.
// Los reportes van separados del boletín: no los leen el RITE ni la grilla de calificaciones.

const personSelect = { select: { id: true, firstName: true, lastName: true } } as const

const planInclude = {
  student: { select: { id: true, firstName: true, lastName: true, dni: true } },
  responsible: personSelect,
  // El último reporte, para mostrar cuándo fue el último seguimiento
  reports: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
} satisfies Prisma.FortePlanInclude

type PlanWithRelations = Prisma.FortePlanGetPayload<{ include: typeof planInclude }>

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.lastName}, ${person.firstName}`

function toPlanResponse(plan: PlanWithRelations) {
  return {
    id: plan.id,
    student: plan.student,
    pedagogicalGoals: plan.pedagogicalGoals,
    assignedAt: plan.assignedAt,
    status: plan.status,
    responsible: plan.responsible
      ? { id: plan.responsible.id, name: fullName(plan.responsible) }
      : null,
    lastReportAt: plan.reports[0]?.date ?? null,
    updatedAt: plan.updatedAt,
  }
}

async function findPlanOrFail(id: string) {
  const plan = await prisma.fortePlan.findUnique({ where: { id }, include: planInclude })
  if (!plan) throw new HttpError(404, 'Plan Forte no encontrado')
  return plan
}

// El responsable tiene que ser un usuario activo del sistema
async function assertResponsible(responsibleId: string) {
  const user = await prisma.user.findUnique({
    where: { id: responsibleId },
    select: { status: true },
  })
  if (!user) throw new HttpError(404, 'Responsable no encontrado')
  if (user.status !== UserStatus.ACTIVE) {
    throw new HttpError(409, 'El responsable tiene que ser un usuario activo')
  }
}

// Lista los planes: por defecto los activos; con studentId, el plan de ese alumno (para su ficha)
export async function listFortePlans(query: ListFortePlansQuery) {
  const plans = await prisma.fortePlan.findMany({
    where: {
      ...(query.status !== 'ALL' && { status: query.status }),
      ...(query.studentId && { studentId: query.studentId }),
    },
    include: planInclude,
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  })
  return plans.map(toPlanResponse)
}

// Alta de un alumno en el programa. Si ya tuvo un plan (finalizado o dado de baja), se reactiva
export async function createFortePlan(input: CreateFortePlanInput) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, firstName: true, lastName: true, status: true },
  })
  if (!student) throw new HttpError(404, 'Estudiante no encontrado')
  if (student.status === StudentStatus.INACTIVE) {
    throw new HttpError(
      409,
      `${fullName(student)} está dado de baja: no se puede asignar al Plan Forte`
    )
  }
  await assertResponsible(input.responsibleId)

  const existing = await prisma.fortePlan.findUnique({ where: { studentId: input.studentId } })
  if (existing?.status === FortePlanStatus.ACTIVE) {
    throw new HttpError(409, `${fullName(student)} ya está en el Plan Forte`)
  }

  const data = {
    pedagogicalGoals: input.pedagogicalGoals,
    responsibleId: input.responsibleId,
    status: FortePlanStatus.ACTIVE,
    assignedAt: new Date(),
  }

  // Ya tuvo un plan: se reactiva el mismo, con sus reportes anteriores como historial
  if (existing) {
    const plan = await prisma.fortePlan.update({
      where: { id: existing.id },
      data,
      include: planInclude,
    })
    return toPlanResponse(plan)
  }

  try {
    const plan = await prisma.fortePlan.create({
      data: { ...data, studentId: input.studentId },
      include: planInclude,
    })
    return toPlanResponse(plan)
  } catch (err) {
    // La base permite un solo plan por alumno (por ejemplo, ante un doble clic)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, `${fullName(student)} ya está en el Plan Forte`)
    }
    throw err
  }
}

// Cambia los objetivos, el responsable o el estado (finalizar o dar de baja)
export async function updateFortePlan(id: string, input: UpdateFortePlanInput) {
  await findPlanOrFail(id)
  if (input.responsibleId) await assertResponsible(input.responsibleId)

  const plan = await prisma.fortePlan.update({
    where: { id },
    data: {
      ...(input.pedagogicalGoals !== undefined && { pedagogicalGoals: input.pedagogicalGoals }),
      ...(input.responsibleId !== undefined && { responsibleId: input.responsibleId }),
      ...(input.status !== undefined && { status: input.status }),
    },
    include: planInclude,
  })
  return toPlanResponse(plan)
}

// Historial de reportes de un plan, del más reciente al más viejo
export async function listFortePlanReports(planId: string) {
  await findPlanOrFail(planId)
  const reports = await prisma.fortePlanReport.findMany({
    where: { fortePlanId: planId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { author: personSelect },
  })
  return reports.map((report) => ({
    id: report.id,
    date: report.date,
    progress: report.progress,
    observations: report.observations,
    author: report.author ? { id: report.author.id, name: fullName(report.author) } : null,
    createdAt: report.createdAt,
  }))
}

// Carga un reporte de evolución. El docente solo puede hacerlo si es el responsable del plan
export async function createFortePlanReport(
  planId: string,
  input: CreateFortePlanReportInput,
  user: { userId: string; role: Role }
) {
  const plan = await findPlanOrFail(planId)

  if (user.role === Role.TEACHER && plan.responsibleId !== user.userId) {
    throw new HttpError(403, 'Solo el responsable del plan o la dirección pueden cargar reportes')
  }
  if (plan.status !== FortePlanStatus.ACTIVE) {
    throw new HttpError(
      409,
      `${fullName(plan.student)} no está activo en el Plan Forte: no se pueden cargar reportes`
    )
  }

  const report = await prisma.fortePlanReport.create({
    data: {
      fortePlanId: planId,
      progress: input.progress,
      observations: input.observations ?? null,
      date: input.date ? new Date(`${input.date}T12:00:00.000Z`) : new Date(),
      authorId: user.userId,
    },
    include: { author: personSelect },
  })
  return {
    id: report.id,
    date: report.date,
    progress: report.progress,
    observations: report.observations,
    author: report.author ? { id: report.author.id, name: fullName(report.author) } : null,
    createdAt: report.createdAt,
  }
}

// Posibles responsables del seguimiento: los docentes activos
export async function listResponsibleCandidates() {
  const users = await prisma.user.findMany({
    where: { role: Role.TEACHER, status: UserStatus.ACTIVE },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return users.map((user) => ({ id: user.id, name: fullName(user) }))
}
