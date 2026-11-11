import { FortePlanStatus, Prisma, Role, StudentStatus, UserStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateFortePlanInput,
  CreateFortePlanReportInput,
  ListFortePlansQuery,
  UpdateFortePlanInput,
} from '@/schemas/fortePlan.schema'
import { HttpError } from '@/utils/httpError'
import { todayInSchoolTimeZone } from '@/utils/schoolDate'

// Plan Forte (E4-RF-14, CRM-089): asignación de alumnos al programa y reportes de evolución.
// Los reportes van separados del boletín: no los leen el RITE ni la grilla de calificaciones.

const personSelect = { select: { id: true, firstName: true, lastName: true } } as const

// Quiénes pueden ser responsables del seguimiento: el personal de la escuela
const RESPONSIBLE_ROLES: Role[] = [Role.TEACHER, Role.EOE_DIRECTIVE, Role.SCHOOL_MANAGEMENT]

const planInclude = {
  student: { select: { id: true, firstName: true, lastName: true, dni: true } },
  responsible: personSelect,
  // El último reporte, para mostrar cuándo fue el último seguimiento
  reports: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
} satisfies Prisma.FortePlanInclude

const reportInclude = { author: personSelect } satisfies Prisma.FortePlanReportInclude

type PlanWithRelations = Prisma.FortePlanGetPayload<{ include: typeof planInclude }>
type ReportWithAuthor = Prisma.FortePlanReportGetPayload<{ include: typeof reportInclude }>

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

function toReportResponse(report: ReportWithAuthor) {
  return {
    id: report.id,
    date: report.date,
    progress: report.progress,
    observations: report.observations,
    author: report.author ? { id: report.author.id, name: fullName(report.author) } : null,
    createdAt: report.createdAt,
  }
}

async function findPlanOrFail(id: string) {
  const plan = await prisma.fortePlan.findUnique({ where: { id }, include: planInclude })
  if (!plan) throw new HttpError(404, 'Plan Forte no encontrado')
  return plan
}

// El responsable tiene que ser personal de la escuela (docente, EOE o dirección) y estar activo
async function assertResponsible(responsibleId: string) {
  const user = await prisma.user.findUnique({
    where: { id: responsibleId },
    select: { status: true, role: true },
  })
  if (!user) throw new HttpError(404, 'Responsable no encontrado')
  if (!RESPONSIBLE_ROLES.includes(user.role)) {
    throw new HttpError(
      409,
      'El responsable tiene que ser personal de la escuela (docente, EOE o dirección)'
    )
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new HttpError(409, 'El responsable tiene que ser un usuario activo')
  }
}

// Lista los planes. Sin status: con studentId, todos los estados (la ficha muestra también los
// planes cerrados); sin studentId, solo los activos
export async function listFortePlans(query: ListFortePlansQuery) {
  const status = query.status ?? (query.studentId ? 'ALL' : FortePlanStatus.ACTIVE)

  const plans = await prisma.fortePlan.findMany({
    where: {
      ...(status !== 'ALL' && { status }),
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

// Cambia los objetivos, el responsable o cierra el plan (finalizar o dar de baja).
// Solo con el plan activo: un plan cerrado no se edita. Para retomarlo, se vuelve a asignar
// con el alta, que valida al alumno y al responsable
export async function updateFortePlan(id: string, input: UpdateFortePlanInput) {
  const current = await findPlanOrFail(id)
  if (current.status !== FortePlanStatus.ACTIVE) {
    throw new HttpError(
      409,
      `${fullName(current.student)} no está activo en el Plan Forte: para cambiarlo, volvé a asignarlo`
    )
  }
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
    include: reportInclude,
  })
  return reports.map(toReportResponse)
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
      // Siempre el día (el elegido o el de hoy en Argentina) a las 12:00 UTC, así no cambia
      // de día al mostrarlo, aunque se cargue de noche
      date: new Date(`${input.date ?? todayInSchoolTimeZone()}T12:00:00.000Z`),
      authorId: user.userId,
    },
    include: reportInclude,
  })
  return toReportResponse(report)
}

// Posibles responsables del seguimiento: el personal activo de la escuela (docentes, EOE y
// dirección)
export async function listResponsibleCandidates() {
  const users = await prisma.user.findMany({
    where: { role: { in: RESPONSIBLE_ROLES }, status: UserStatus.ACTIVE },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return users.map((user) => ({ id: user.id, name: fullName(user) }))
}
