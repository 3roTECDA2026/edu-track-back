import { Prisma, Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  AddScheduleSubjectInput,
  CreateScheduleInput,
  UpdateScheduleInput,
  UpdateScheduleSubjectInput,
} from '@/schemas/intensificationSchedule.schema'
import { HttpError } from '@/utils/httpError'

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
const toDay = (value: Date) => value.toISOString().slice(0, 10)

const scheduleInclude = {
  academicYear: { select: { id: true, year: true } },
  subjects: {
    include: {
      subject: { select: { id: true, name: true, gradeLevel: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { subject: { name: 'asc' } },
  },
  _count: { select: { intensifications: true } },
} satisfies Prisma.IntensificationScheduleInclude

type ScheduleWithRelations = Prisma.IntensificationScheduleGetPayload<{
  include: typeof scheduleInclude
}>

// Respuesta del período, con sus materias y docentes
function toScheduleResponse(schedule: ScheduleWithRelations) {
  return {
    id: schedule.id,
    year: schedule.academicYear.year,
    period: schedule.period,
    startDate: toDay(schedule.startDate),
    endDate: toDay(schedule.endDate),
    assignedStudents: schedule._count.intensifications,
    subjects: schedule.subjects.map((entry) => ({
      id: entry.id,
      subjectId: entry.subject.id,
      subjectName: entry.subject.name,
      gradeLevel: entry.subject.gradeLevel,
      teacher: entry.teacher
        ? { id: entry.teacher.id, name: `${entry.teacher.firstName} ${entry.teacher.lastName}` }
        : null,
    })),
  }
}

async function findAcademicYearOrFail(year: number) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { year },
    select: { id: true },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')
  return academicYear
}

async function findScheduleOrFail(id: string) {
  const schedule = await prisma.intensificationSchedule.findUnique({
    where: { id },
    include: scheduleInclude,
  })
  if (!schedule) throw new HttpError(404, 'Período de intensificación no encontrado')
  return schedule
}

// El docente responsable tiene que existir y tener rol docente
async function assertTeacher(teacherId: string | null | undefined) {
  if (!teacherId) return
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { role: true },
  })
  if (!teacher) throw new HttpError(404, 'Docente no encontrado')
  if (teacher.role !== Role.TEACHER) {
    throw new HttpError(400, 'El responsable tiene que ser un usuario con rol docente')
  }
}

// Períodos de un ciclo lectivo, ordenados por fecha de inicio
export async function listSchedules(year: number) {
  const academicYear = await findAcademicYearOrFail(year)
  const schedules = await prisma.intensificationSchedule.findMany({
    where: { academicYearId: academicYear.id },
    include: scheduleInclude,
    orderBy: { startDate: 'asc' },
  })
  return schedules.map(toScheduleResponse)
}

export async function createSchedule(input: CreateScheduleInput) {
  const academicYear = await findAcademicYearOrFail(input.year)

  try {
    const schedule = await prisma.intensificationSchedule.create({
      data: {
        academicYearId: academicYear.id,
        period: input.period,
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
      },
      include: scheduleInclude,
    })
    return toScheduleResponse(schedule)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'Ese período ya existe en este ciclo lectivo')
    }
    throw err
  }
}

export async function updateSchedule(id: string, input: UpdateScheduleInput) {
  const schedule = await findScheduleOrFail(id)
  const startDate = input.startDate ?? toDay(schedule.startDate)
  const endDate = input.endDate ?? toDay(schedule.endDate)
  if (startDate > endDate) {
    throw new HttpError(400, 'La fecha de fin no puede ser anterior a la de inicio')
  }

  const updated = await prisma.intensificationSchedule.update({
    where: { id },
    data: { startDate: toDate(startDate), endDate: toDate(endDate) },
    include: scheduleInclude,
  })
  return toScheduleResponse(updated)
}

// Solo se puede borrar un período sin alumnos asignados
export async function deleteSchedule(id: string) {
  const schedule = await findScheduleOrFail(id)
  if (schedule._count.intensifications > 0) {
    throw new HttpError(409, 'El período tiene alumnos asignados y no se puede borrar')
  }
  await prisma.intensificationSchedule.delete({ where: { id } })
}

export async function addScheduleSubject(id: string, input: AddScheduleSubjectInput) {
  await findScheduleOrFail(id)

  const subject = await prisma.subject.findUnique({
    where: { id: input.subjectId },
    select: { id: true },
  })
  if (!subject) throw new HttpError(404, 'Materia no encontrada')
  await assertTeacher(input.teacherId)

  try {
    await prisma.intensificationScheduleSubject.create({
      data: { scheduleId: id, subjectId: input.subjectId, teacherId: input.teacherId ?? null },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'La materia ya está en este período')
    }
    throw err
  }
  return toScheduleResponse(await findScheduleOrFail(id))
}

async function findScheduleSubjectOrFail(id: string, entryId: string) {
  const entry = await prisma.intensificationScheduleSubject.findUnique({
    where: { id: entryId },
    select: { id: true, scheduleId: true, subjectId: true },
  })
  if (!entry || entry.scheduleId !== id) {
    throw new HttpError(404, 'La materia no está en este período')
  }
  return entry
}

export async function updateScheduleSubject(
  id: string,
  entryId: string,
  input: UpdateScheduleSubjectInput
) {
  await findScheduleSubjectOrFail(id, entryId)
  await assertTeacher(input.teacherId)
  await prisma.intensificationScheduleSubject.update({
    where: { id: entryId },
    data: { teacherId: input.teacherId },
  })
  return toScheduleResponse(await findScheduleOrFail(id))
}

// Solo se puede sacar una materia si no hay alumnos asignados a ella en el período
export async function removeScheduleSubject(id: string, entryId: string) {
  const entry = await findScheduleSubjectOrFail(id, entryId)
  const assigned = await prisma.intensification.count({
    where: { scheduleId: id, enrollment: { subjectId: entry.subjectId } },
  })
  if (assigned > 0) {
    throw new HttpError(409, 'La materia tiene alumnos asignados en este período')
  }
  await prisma.intensificationScheduleSubject.delete({ where: { id: entryId } })
  return toScheduleResponse(await findScheduleOrFail(id))
}