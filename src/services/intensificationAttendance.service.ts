import { Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { MODELS_WITH_LOCATION } from '@/schemas/intensification.schema'
import type {
  IntensificationAttendanceQuery,
  IntensificationAttendanceValue,
  SaveIntensificationAttendanceInput,
} from '@/schemas/intensificationAttendance.schema'
import { HttpError } from '@/utils/httpError'
import { isWeekend, toDate, toDay, todayInSchoolTimeZone } from '@/utils/schoolDate'

// Asistencia en intensificación (CRM-059).
// Se registra por materia, aparte de la asistencia diaria del curso, y solo para los alumnos que
// intensifican en otra sección (modelos 2 y 3). Se guarda en SubjectAttendance, unida a la
// intensificación de cada alumno.

type AuthUser = { userId: string; role: Role }

// "2026-12-09" -> "09/12/2026", para los mensajes
const formatDay = (day: string) => day.split('-').reverse().join('/')

// Lo que se guarda en la base (present / excused) se muestra como un solo valor
function toValue(present: boolean, excused: boolean): IntensificationAttendanceValue {
  if (present) return 'PRESENT'
  return excused ? 'EXCUSED' : 'ABSENT'
}

// El período tiene que existir y la materia tiene que estar en ese período del calendario
async function findScheduleOrFail(scheduleId: string, subjectId: string) {
  const schedule = await prisma.intensificationSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      period: true,
      startDate: true,
      endDate: true,
      subjects: { where: { subjectId }, select: { subjectId: true } },
    },
  })
  if (!schedule) throw new HttpError(404, 'Período de intensificación no encontrado')
  if (schedule.subjects.length === 0) {
    throw new HttpError(409, 'La materia no está en este período del calendario')
  }
  return schedule
}

// Solo se toma asistencia en los días del período
function assertDateInPeriod(date: string, schedule: { startDate: Date; endDate: Date }) {
  const start = toDay(schedule.startDate)
  const end = toDay(schedule.endDate)
  if (date < start || date > end) {
    throw new HttpError(
      409,
      `La fecha tiene que estar dentro del período (del ${formatDay(start)} al ${formatDay(end)})`
    )
  }
}

// Alumnos del período y la materia que intensifican en otra sección, con lo cargado en esa fecha
export async function getIntensificationAttendance(query: IntensificationAttendanceQuery) {
  const schedule = await findScheduleOrFail(query.scheduleId, query.subjectId)
  assertDateInPeriod(query.date, schedule)

  const items = await prisma.intensification.findMany({
    where: {
      scheduleId: schedule.id,
      enrollment: { subjectId: query.subjectId },
      model: { in: MODELS_WITH_LOCATION },
    },
    select: {
      id: true,
      model: true,
      responsibleTeacherId: true,
      targetClassSection: { select: { id: true, grade: true, division: true, shift: true } },
      enrollment: {
        select: { student: { select: { id: true, firstName: true, lastName: true, dni: true } } },
      },
      attendances: {
        where: { classDate: toDate(query.date) },
        select: { present: true, excused: true },
      },
    },
  })

  const students = items
    .map((item) => {
      const attendance = item.attendances[0]
      return {
        intensificationId: item.id,
        student: item.enrollment.student,
        model: item.model,
        targetClassSection: item.targetClassSection,
        responsibleTeacherId: item.responsibleTeacherId,
        value: attendance ? toValue(attendance.present, attendance.excused) : null,
      }
    })
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName, 'es'))

  return {
    schedule: {
      id: schedule.id,
      period: schedule.period,
      startDate: toDay(schedule.startDate),
      endDate: toDay(schedule.endDate),
    },
    date: query.date,
    students,
  }
}

// Guarda la asistencia de un día. Reglas (las mismas de la asistencia diaria, más las del período):
// - solo días del período, nunca sábados, domingos ni días futuros;
// - solo alumnos de ese período y materia que intensifican en otra sección (modelos 2 y 3);
// - un docente solo carga la de sus alumnos; la dirección y la administración, la de todos.
// Volver a guardar el mismo día actualiza lo cargado (una sola carga por alumno y día).
export async function saveIntensificationAttendance(
  input: SaveIntensificationAttendanceInput,
  user: AuthUser
) {
  const schedule = await findScheduleOrFail(input.scheduleId, input.subjectId)
  assertDateInPeriod(input.date, schedule)
  if (isWeekend(input.date)) {
    throw new HttpError(409, 'No se toma asistencia los sábados ni los domingos')
  }
  if (input.date > todayInSchoolTimeZone()) {
    throw new HttpError(409, 'No se puede tomar asistencia de días futuros')
  }

  const ids = input.records.map((record) => record.intensificationId)
  const intensifications = await prisma.intensification.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      scheduleId: true,
      model: true,
      responsibleTeacherId: true,
      enrollmentId: true,
      enrollment: { select: { studentId: true, subjectId: true } },
    },
  })
  if (intensifications.length !== ids.length) {
    throw new HttpError(404, 'Alguna de las asignaciones no existe')
  }

  for (const item of intensifications) {
    if (item.scheduleId !== schedule.id || item.enrollment.subjectId !== input.subjectId) {
      throw new HttpError(409, 'Alguna asignación no corresponde a este período y materia')
    }
    if (!MODELS_WITH_LOCATION.includes(item.model)) {
      throw new HttpError(
        409,
        'Solo se registra la asistencia de quienes intensifican en otra sección (modelos 2 y 3)'
      )
    }
    if (user.role === Role.TEACHER && item.responsibleTeacherId !== user.userId) {
      throw new HttpError(
        403,
        'Solo el docente responsable o la dirección pueden cargar esta asistencia'
      )
    }
  }

  const byId = new Map(intensifications.map((item) => [item.id, item]))
  const classDate = toDate(input.date)

  // registeredById guarda quién hizo el último cambio
  const operations = input.records.map((record) => {
    const item = byId.get(record.intensificationId)
    if (!item) throw new HttpError(404, 'Alguna de las asignaciones no existe')
    const present = record.value === 'PRESENT'
    const excused = record.value === 'EXCUSED'
    return prisma.subjectAttendance.upsert({
      where: { intensificationId_classDate: { intensificationId: item.id, classDate } },
      create: {
        studentId: item.enrollment.studentId,
        subjectId: item.enrollment.subjectId,
        enrollmentId: item.enrollmentId,
        classDate,
        present,
        excused,
        isIntensification: true,
        intensificationId: item.id,
        registeredById: user.userId,
      },
      update: { present, excused, registeredById: user.userId },
    })
  })

  const saved = await prisma.$transaction(operations)
  return { saved: saved.length }
}
