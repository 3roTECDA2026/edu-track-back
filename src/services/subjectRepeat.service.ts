import { AuditActionType, CourseType, PendingSubjectStatus, Prisma, Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateSubjectRepeatInput,
  ListSubjectRepeatsQuery,
  RepeatOptionsQuery,
  UpdateSubjectRepeatInput,
} from '@/schemas/subjectRepeat.schema'
import { assertSubjectLimit } from '@/services/subjectEnrollmentLimit'
import { HttpError } from '@/utils/httpError'
import {
  deleteBlockReason,
  repeatBlockReason,
  sectionBlockReason,
} from '@/utils/subjectRepeatRules'

// Recursado de materias (CRM-082, E4-RF-09). Un recursado es una inscripción REPEAT en una
// sección del ciclo activo, vinculada a la MPAA que se recursa. Se califica y se toma asistencia
// como cualquier cursada.

// Quién hace la acción (para la auditoría)
export interface Actor {
  userId: string
  role: Role
  ipAddress: string
}

const sectionSelect = { id: true, grade: true, division: true, shift: true } as const

const subjectRepeatInclude = {
  student: { select: { id: true, dni: true, firstName: true, lastName: true } },
  subject: { select: { id: true, name: true, gradeLevel: true } },
  classSection: { select: sectionSelect },
  academicYear: { select: { id: true, year: true } },
  repeatedPendingSubject: {
    select: { id: true, status: true, originAcademicYear: { select: { year: true } } },
  },
  grade: { select: { id: true } },
  _count: { select: { subjectAttendances: true, intensifications: true } },
} satisfies Prisma.EnrollmentInclude

type SubjectRepeatRecord = Prisma.EnrollmentGetPayload<{ include: typeof subjectRepeatInclude }>

function toSubjectRepeatResponse(record: SubjectRepeatRecord) {
  const { grade, _count, repeatedPendingSubject, ...rest } = record
  return {
    ...rest,
    pendingSubject: repeatedPendingSubject && {
      id: repeatedPendingSubject.id,
      status: repeatedPendingSubject.status,
      originYear: repeatedPendingSubject.originAcademicYear.year,
    },
    // Para que el front sepa si el recursado todavía se puede quitar
    hasGrade: grade !== null,
    attendanceCount: _count.subjectAttendances,
  }
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

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
      affectedEntity: 'SubjectRepeat',
      entityId,
      previousData: previousData ? toJson(previousData) : undefined,
      newData: newData ? toJson(newData) : undefined,
      ipAddress: actor.ipAddress,
    },
  })
}

async function getActiveCycleOrFail(db: Prisma.TransactionClient) {
  const cycle = await db.academicYear.findFirst({
    where: { active: true },
    orderBy: { year: 'desc' },
    select: { id: true, year: true },
  })
  if (!cycle) throw new HttpError(409, 'No hay un ciclo lectivo activo')
  return cycle
}

async function findSectionOrFail(db: Prisma.TransactionClient, classSectionId: string) {
  const section = await db.classSection.findUnique({
    where: { id: classSectionId },
    select: { ...sectionSelect, academicYearId: true },
  })
  if (!section) throw new HttpError(404, 'La sección indicada no existe')
  return section
}

// Datos de la MPAA que hacen falta para decidir si se puede recursar
const pendingForRepeatSelect = {
  id: true,
  studentId: true,
  subjectId: true,
  status: true,
  originAcademicYear: { select: { year: true } },
  subject: { select: { gradeLevel: true } },
  originEnrollment: {
    select: {
      originalGradeLevel: true,
      intensifications: { select: { resultCode: true } },
    },
  },
} satisfies Prisma.PendingSubjectSelect

type PendingForRepeat = Prisma.PendingSubjectGetPayload<{ select: typeof pendingForRepeatSelect }>

// Año de la materia: el de origen si quedó guardado, si no el de la materia
const gradeLevelOf = (pending: PendingForRepeat) =>
  pending.originEnrollment.originalGradeLevel ?? pending.subject.gradeLevel

const toRepeatPendingInfo = (pending: PendingForRepeat) => ({
  status: pending.status,
  originYear: pending.originAcademicYear.year,
  gradeLevel: gradeLevelOf(pending),
  attempts: pending.originEnrollment.intensifications,
})

// Crea el recursado dentro de la transacción que recibe. Queda exportada para que el PATE la
// llame al confirmarse (CRM-078), en su propia transacción: si falla, no se confirma el PATE.
export async function createSubjectRepeat(
  tx: Prisma.TransactionClient,
  input: CreateSubjectRepeatInput,
  actor: Actor
) {
  const pending = await tx.pendingSubject.findUnique({
    where: { id: input.pendingSubjectId },
    select: pendingForRepeatSelect,
  })
  if (!pending) throw new HttpError(404, 'La materia pendiente indicada no existe')

  // Bloquea la fila del alumno hasta el fin de la transacción: dos altas simultáneas del mismo
  // alumno se ejecutan de a una. Lo necesita el control del límite de materias (CRM-061).
  await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${pending.studentId} FOR UPDATE`

  const [activeCycle, section] = await Promise.all([
    getActiveCycleOrFail(tx),
    findSectionOrFail(tx, input.classSectionId),
  ])

  const reason = repeatBlockReason(toRepeatPendingInfo(pending), section, activeCycle)
  if (reason) throw new HttpError(409, reason)

  // Límite de 12 materias por ciclo, cursadas y recursadas (E3-RF-13, CRM-061). Se cuenta con la
  // fila del alumno ya bloqueada, así dos altas simultáneas no pueden pasarse del máximo
  await assertSubjectLimit(pending.studentId, activeCycle.id, 1, tx)

  try {
    const created = await tx.enrollment.create({
      data: {
        studentId: pending.studentId,
        subjectId: pending.subjectId,
        classSectionId: section.id,
        academicYearId: activeCycle.id,
        courseType: CourseType.REPEAT,
        originalGradeLevel: gradeLevelOf(pending),
        repeatedPendingSubjectId: pending.id,
      },
      include: subjectRepeatInclude,
    })
    await writeAudit(tx, actor, AuditActionType.CREATE, created.id, null, {
      pendingSubjectId: pending.id,
      classSectionId: section.id,
      academicYearId: activeCycle.id,
    })
    return toSubjectRepeatResponse(created)
  } catch (err) {
    // Único de Enrollment: una sola inscripción REPEAT por alumno, materia y ciclo
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'El alumno ya recursa esta materia en el ciclo activo')
    }
    throw err
  }
}

// POST /subject-repeats: alta manual (Gestión Escolar)
export async function assignSubjectRepeat(input: CreateSubjectRepeatInput, actor: Actor) {
  return prisma.$transaction((tx) => createSubjectRepeat(tx, input, actor))
}

// GET /subject-repeats: recursados por alumno y/o ciclo
export async function listSubjectRepeats(query: ListSubjectRepeatsQuery) {
  const records = await prisma.enrollment.findMany({
    where: {
      courseType: CourseType.REPEAT,
      ...(query.studentId && { studentId: query.studentId }),
      ...(query.year && { academicYear: { year: query.year } }),
    },
    include: subjectRepeatInclude,
    orderBy: [
      { academicYear: { year: 'desc' } },
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
      { subject: { name: 'asc' } },
    ],
  })
  return records.map(toSubjectRepeatResponse)
}

// GET /subject-repeats/options: MPAA del alumno que se pueden recursar en el ciclo activo y las
// secciones posibles para cada una (para el diálogo de alta del front)
export async function getRepeatOptions(query: RepeatOptionsQuery) {
  const student = await prisma.student.findUnique({
    where: { id: query.studentId },
    select: { id: true },
  })
  if (!student) throw new HttpError(404, 'El alumno indicado no existe')

  const activeCycle = await getActiveCycleOrFail(prisma)
  const [pendings, sections, currentRepeats] = await Promise.all([
    prisma.pendingSubject.findMany({
      where: { studentId: query.studentId, status: PendingSubjectStatus.PENDING },
      select: { ...pendingForRepeatSelect, subject: { select: { name: true, gradeLevel: true } } },
      orderBy: [{ originAcademicYear: { year: 'asc' } }, { subject: { name: 'asc' } }],
    }),
    prisma.classSection.findMany({
      where: { academicYearId: activeCycle.id },
      select: sectionSelect,
      orderBy: [{ grade: 'asc' }, { division: 'asc' }, { shift: 'asc' }],
    }),
    prisma.enrollment.findMany({
      where: {
        studentId: query.studentId,
        academicYearId: activeCycle.id,
        courseType: CourseType.REPEAT,
      },
      select: { id: true, subjectId: true, classSection: { select: sectionSelect } },
    }),
  ])

  const repeatBySubject = new Map(currentRepeats.map((repeat) => [repeat.subjectId, repeat]))

  return {
    activeCycle,
    options: pendings.map((pending) => {
      const gradeLevel = gradeLevelOf(pending)
      const currentRepeat = repeatBySubject.get(pending.subjectId) ?? null
      // La sección no influye en el motivo: se evalúa con una del año de la materia
      const reason = repeatBlockReason(
        toRepeatPendingInfo(pending),
        { academicYearId: activeCycle.id, grade: gradeLevel },
        activeCycle
      )
      return {
        pendingSubjectId: pending.id,
        subject: { id: pending.subjectId, name: pending.subject.name },
        originYear: pending.originAcademicYear.year,
        gradeLevel,
        currentRepeat,
        blockReason: currentRepeat ? 'Ya recursa esta materia en el ciclo activo' : reason,
        sections: sections.filter((section) => section.grade === gradeLevel),
      }
    }),
  }
}

async function findRepeatOrFail(db: Prisma.TransactionClient, id: string) {
  const record = await db.enrollment.findUnique({ where: { id }, include: subjectRepeatInclude })
  if (!record || record.courseType !== CourseType.REPEAT) {
    throw new HttpError(404, 'Recursado no encontrado')
  }
  return record
}

// PATCH /subject-repeats/:id: cambia la sección. Las notas y la asistencia se conservan.
export async function updateSubjectRepeat(
  id: string,
  input: UpdateSubjectRepeatInput,
  actor: Actor
) {
  return prisma.$transaction(async (tx) => {
    const current = await findRepeatOrFail(tx, id)
    const [activeCycle, section] = await Promise.all([
      getActiveCycleOrFail(tx),
      findSectionOrFail(tx, input.classSectionId),
    ])
    if (current.academicYearId !== activeCycle.id) {
      throw new HttpError(409, 'Solo se pueden cambiar los recursados del ciclo activo')
    }
    const gradeLevel = current.originalGradeLevel ?? current.subject.gradeLevel
    const reason = sectionBlockReason(gradeLevel, section, activeCycle)
    if (reason) throw new HttpError(409, reason)

    const updated = await tx.enrollment.update({
      where: { id },
      data: { classSectionId: section.id },
      include: subjectRepeatInclude,
    })
    await writeAudit(
      tx,
      actor,
      AuditActionType.UPDATE,
      id,
      { classSectionId: current.classSection.id },
      { classSectionId: section.id }
    )
    return toSubjectRepeatResponse(updated)
  })
}

// DELETE /subject-repeats/:id: baja física, solo si no tiene notas, asistencia ni intensificaciones
export async function deleteSubjectRepeat(id: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const current = await findRepeatOrFail(tx, id)
    const reason = deleteBlockReason({
      hasGrade: current.grade !== null,
      attendances: current._count.subjectAttendances,
      intensifications: current._count.intensifications,
    })
    if (reason) throw new HttpError(409, reason)

    try {
      await tx.enrollment.delete({ where: { id } })
    } catch (err) {
      // Otra tabla apunta a la inscripción (por ejemplo, un PATE o una comisión evaluadora)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new HttpError(
          409,
          'El recursado está vinculado a otros registros (por ejemplo, un PATE): no se puede quitar'
        )
      }
      throw err
    }
    await writeAudit(
      tx,
      actor,
      AuditActionType.DELETE,
      id,
      {
        studentId: current.studentId,
        subjectId: current.subjectId,
        classSectionId: current.classSection.id,
        academicYearId: current.academicYearId,
        pendingSubjectId: current.repeatedPendingSubjectId,
      },
      null
    )
    return { deleted: true }
  })
}
