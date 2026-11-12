import { AuditActionType, Role, type Prisma } from '@prisma/client'
import { todayInSchoolTimeZone } from '@/utils/schoolDate'
import { prisma } from '@/lib/prisma'
import type {
  CreateInterventionInput,
  ListInterventionsQuery,
  UpdateInterventionInput,
} from '@/schemas/intervention.schema'
import { HttpError } from '@/utils/httpError'

// Ventana durante la cual el autor puede editar su intervención
const EDIT_WINDOW_HOURS = 48
// Las intervenciones manejan la fecha como día de calendario en hora Argentina (-03:00),
// para que el alta y el filtro coincidan.
function schoolDayStart(day: string) {
  return new Date(`${day}T00:00:00.000-03:00`)
}
function schoolDayAfter(day: string) {
  const start = schoolDayStart(day)
  start.setUTCDate(start.getUTCDate() + 1)
  return start
}

// Datos del usuario que realiza la acción (para permisos y auditoría).
interface Actor {
  userId: string
  role: Role
  ipAddress: string
}

// Relaciones que devolvemos en cada intervención.
const interventionInclude = {
  student: { select: { id: true, firstName: true, lastName: true, dni: true } },
  classSection: { select: { id: true, grade: true, division: true, shift: true } },
  author: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.InterventionInclude

// Cursos (secciones) que tiene asignados un docente.
async function getTeacherSectionIds(teacherId: string): Promise<string[]> {
  const assignments = await prisma.teacherSubjectCourse.findMany({
    where: { teacherId },
    select: { classSectionId: true },
  })
  return [...new Set(assignments.map((a) => a.classSectionId))]
}

// Convierte un registro a JSON plano para guardarlo en AuditLog.
function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

// Registra el alta/modificación en AuditLog dentro de la misma transacción.
async function writeAudit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: AuditActionType,
  entityId: string,
  previousData: unknown,
  newData: unknown
) {
  await tx.auditLog.create({
    data: {
      userId: actor.userId,
      action,
      affectedEntity: 'Intervention',
      entityId,
      previousData: previousData ? toJson(previousData) : undefined,
      newData: newData ? toJson(newData) : undefined,
      ipAddress: actor.ipAddress,
    },
  })
}

// Crear una intervención.
export async function createIntervention(input: CreateInterventionInput, actor: Actor) {
  // Validar que el alumno y el curso existan, para devolver un 404 claro
  // (en vez del 409 genérico de Prisma por clave foránea).
  const [studentExists, sectionExists] = await Promise.all([
    prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true } }),
    prisma.classSection.findUnique({ where: { id: input.classSectionId }, select: { id: true } }),
  ])
  if (!studentExists) throw new HttpError(404, 'El alumno indicado no existe')
  if (!sectionExists) throw new HttpError(404, 'El curso indicado no existe')
  // Docente: solo puede registrar en cursos que tiene asignados.
  if (actor.role === Role.TEACHER) {
    const sectionIds = await getTeacherSectionIds(actor.userId)
    if (!sectionIds.includes(input.classSectionId)) {
      throw new HttpError(403, 'Solo podés registrar intervenciones en tus propios cursos')
    }
  }
  // El alumno debe pertenecer a la sección indicada
  // evita que, con el curso de un docente y el id de cualquier alumno, se cree la intervención.
  const belongsToSection = await prisma.enrollmentHistory.findFirst({
    where: {
      studentId: input.studentId,
      classSectionId: input.classSectionId,
      endDate: null,
    },
    select: { id: true },
  })
  if (!belongsToSection) {
    throw new HttpError(400, 'El alumno no pertenece al curso indicado')
  }
  return prisma.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        studentId: input.studentId,
        classSectionId: input.classSectionId,
        authorId: actor.userId,
        eventType: input.eventType,
        description: input.description,
        interventionProposal: input.interventionProposal,
        involvedActors: input.involvedActors,
        date: schoolDayStart(input.date ?? todayInSchoolTimeZone()),
      },
      include: interventionInclude,
    })
    await writeAudit(tx, actor, AuditActionType.CREATE, created.id, null, created)
    return created
  })
}

// Listar intervenciones (por alumno y/o por curso, con filtros de tipo y fechas).
export async function listInterventions(query: ListInterventionsQuery, actor: Actor) {
  const where: Prisma.InterventionWhereInput = {}
  if (query.studentId) where.studentId = query.studentId
  if (query.classSectionId) where.classSectionId = query.classSectionId
  if (query.eventType) where.eventType = query.eventType
  if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: schoolDayStart(query.from) } : {}),
      ...(query.to ? { lt: schoolDayAfter(query.to) } : {}),
    }
  }

  // Docente: restringido a sus cursos
  if (actor.role === Role.TEACHER) {
    const sectionIds = await getTeacherSectionIds(actor.userId)
    if (query.classSectionId && !sectionIds.includes(query.classSectionId)) {
      throw new HttpError(403, 'Solo podés ver intervenciones de tus propios cursos')
    }
    where.classSectionId = query.classSectionId ?? { in: sectionIds }
  }

  const skip = (query.page - 1) * query.limit
  const [data, total] = await prisma.$transaction([
    prisma.intervention.findMany({
      where,
      include: interventionInclude,
      orderBy: { date: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.intervention.count({ where }),
  ])

  return {
    data,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  }
}

// Ver el detalle de una intervención.
export async function getInterventionById(id: string, actor: Actor) {
  const intervention = await prisma.intervention.findUnique({
    where: { id },
    include: interventionInclude,
  })
  if (!intervention) {
    throw new HttpError(404, 'Intervención no encontrada')
  }
  if (actor.role === Role.TEACHER) {
    const sectionIds = await getTeacherSectionIds(actor.userId)
    if (!intervention.classSectionId || !sectionIds.includes(intervention.classSectionId)) {
      throw new HttpError(403, 'No tenés acceso a esta intervención')
    }
  }
  return intervention
}

// Editar: solo el autor y solo dentro de la ventana de 48 hs (criterio 4).
export async function updateIntervention(id: string, input: UpdateInterventionInput, actor: Actor) {
  const existing = await prisma.intervention.findUnique({
    where: { id },
    include: interventionInclude,
  })
  if (!existing) {
    throw new HttpError(404, 'Intervención no encontrada')
  }
  if (existing.authorId !== actor.userId) {
    throw new HttpError(403, 'Solo el autor puede editar su intervención')
  }
  const hoursSinceCreation = (Date.now() - existing.createdAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceCreation > EDIT_WINDOW_HOURS) {
    throw new HttpError(
      409,
      `La intervención ya no se puede editar: pasaron más de ${EDIT_WINDOW_HOURS} horas desde su registro`
    )
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.intervention.update({
      where: { id },
      data: {
        eventType: input.eventType,
        description: input.description,
        interventionProposal: input.interventionProposal,
        involvedActors: input.involvedActors,
        date: input.date ? schoolDayStart(input.date) : undefined,
      },
      include: interventionInclude,
    })
    await writeAudit(tx, actor, AuditActionType.UPDATE, id, existing, updated)
    return updated
  })
}
