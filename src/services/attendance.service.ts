import { AttendanceValue, Prisma, Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { PaginationAttendanceFilters, UpdateSchoolDaysInput } from '@/schemas/attendance.schema'
import { HttpError } from '@/utils/httpError'

// La escuela está en Argentina: "hoy" se calcula con esa hora, no con la del servidor (que puede estar en UTC)
const SCHOOL_TIME_ZONE = 'America/Argentina/Buenos_Aires'

// Motivo que se guarda cuando la falta se marca como justificada (J) en la carga diaria.
// Sirve para distinguirla de una justificación cargada después (por ejemplo, con certificado).
const DAILY_JUSTIFICATION = 'Justificada en la carga diaria'

// Pueden corregir la asistencia de días anteriores (por ejemplo, si la preceptoría se equivocó)
const EDIT_PAST_ROLES: Role[] = [Role.SCHOOL_MANAGEMENT, Role.ADMINISTRATOR]

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
const toDay = (value: Date) => value.toISOString().slice(0, 10)

// Peso de cada valor en faltas: el retardo puede ser de ¼ (QUARTER) o de ½ (HALF)
const WEIGHT: Record<AttendanceValue, number> = {
  PRESENT: 0,
  ABSENT: 1,
  HALF: 0.5,
  QUARTER: 0.25,
}

const isLateArrival = (value: AttendanceValue) =>
  value === AttendanceValue.QUARTER || value === AttendanceValue.HALF

type AttendanceRecordInput = { studentId: string; value: AttendanceValue; justified?: boolean }

// Fecha de hoy (AAAA-MM-DD) según la hora de Argentina
function todayInSchoolTimeZone() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Reglas de la carga:
// - nunca sábados, domingos ni días futuros;
// - el día de hoy lo puede cargar quien toma asistencia;
// - un día anterior solo lo corrigen preceptoría, dirección o administración, dentro del ciclo activo.
async function assertCanRegisterAttendance(date: string, role: Role) {
  const weekDay = toDate(date).getUTCDay()
  if (weekDay === 0 || weekDay === 6) {
    throw new HttpError(409, 'No se toma asistencia los sábados ni los domingos')
  }

  const today = todayInSchoolTimeZone()
  if (date > today) throw new HttpError(409, 'No se puede tomar asistencia de días futuros')

  if (date < today) {
    if (!EDIT_PAST_ROLES.includes(role)) {
      throw new HttpError(
        403,       
 'Solo la dirección o la administración pueden corregir la asistencia de días anteriores'
      )
    }
    const academicYear = await prisma.academicYear.findFirst({
      where: { active: true },
      select: { year: true },
    })
    if (!academicYear || Number(date.slice(0, 4)) !== academicYear.year) {
      throw new HttpError(409, 'Solo se puede corregir la asistencia del ciclo lectivo activo')
    }
  }
}

function enrollmentAtDateWhere(sectionId: string, date: Date): Prisma.EnrollmentHistoryWhereInput {
  const endOfDate = new Date(date)
  endOfDate.setUTCHours(23, 59, 59, 999)

  return {
    classSectionId: sectionId,
    startDate: { lte: endOfDate },
    OR: [{ endDate: null }, { endDate: { gte: date } }],
  }
}

export async function getSectionAttendance(sectionId: string, date: string) {
  const parsedDate = toDate(date)
  const section = await prisma.classSection.findUnique({
    where: { id: sectionId },
    select: { id: true },
  })

  if (!section) throw new HttpError(404, 'Sección no encontrada')

  const [enrollments, attendances] = await Promise.all([
    prisma.enrollmentHistory.findMany({
      where: enrollmentAtDateWhere(sectionId, parsedDate),
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      select: {
        student: { select: { id: true, dni: true, firstName: true, lastName: true } },
      },
    }),
    prisma.dailyAttendance.findMany({
      where: { sectionId, date: parsedDate },
      select: { id: true, studentId: true, date: true, value: true, justified: true, justification: true },
    }),
  ])

  const students = [...new Map(enrollments.map(({ student }) => [student.id, student])).values()]

  return {
    students,
    records: attendances.map((attendance) => ({
      ...attendance,
      date: toDay(attendance.date),
    })),
  }
}

// Secciones del ciclo lectivo activo, tengan o no asistencia cargada,
// para poder tomar asistencia por primera vez en una sección nueva
export async function listAttendanceSections() {
  const sections = await prisma.classSection.findMany({
    where: { academicYear: { active: true } },
    orderBy: [{ grade: 'asc' }, { division: 'asc' }, { shift: 'asc' }],
    select: {
      id: true,
      grade: true,
      division: true,
      shift: true,
      academicYear: { select: { year: true } },
    },
  })

  return sections.map((section) => ({
    id: section.id,
    year: section.academicYear.year,
    grade: section.grade,
    division: section.division,
    shift: section.shift,
  }))
}

// Cómo queda la justificación al volver a guardar un día:
// - con la J, se marca como justificada (conservando el motivo si ya lo tenía);
// - una justificación cargada después (por ejemplo, con certificado) se conserva mientras no cambie la falta;
// - si cambia la falta, o se saca la J de la carga diaria, la justificación se borra.
function justificationData(
  record: AttendanceRecordInput,
  previous?: { value: AttendanceValue; justified: boolean; justification: string | null }
) {
  if (record.justified) {
    return {
      justified: true,
      justification: previous?.justified ? previous.justification : DAILY_JUSTIFICATION,
    }
  }
  if (!previous) return { justified: false, justification: null }

  const valueChanged = previous.value !== record.value
  const justifiedLater = previous.justified && previous.justification !== DAILY_JUSTIFICATION
  if (!valueChanged && justifiedLater) return {}

  const dailyJustificationRemoved = record.value === AttendanceValue.ABSENT && previous.justified
  return valueChanged || dailyJustificationRemoved ? { justified: false, justification: null } : {}
}

export async function saveBatchAttendance(data: {
  date: string
  sectionId: string
  registeredById: string
  role: Role
  records: AttendanceRecordInput[]
}) {
  const { date, sectionId, registeredById, role, records } = data
  await assertCanRegisterAttendance(date, role)

  // Solo una falta (ausente) puede venir justificada desde la carga diaria
  if (records.some((record) => record.justified && record.value !== AttendanceValue.ABSENT)) {
    throw new HttpError(400, 'Solo una inasistencia (ausente) puede marcarse como justificada')
  }

  const parsedDate = toDate(date)
  const enrolledStudents = await prisma.enrollmentHistory.findMany({
    where: enrollmentAtDateWhere(sectionId, parsedDate),
    select: { studentId: true },
  })

  if (enrolledStudents.length === 0) {
    throw new HttpError(409, 'La sección no tiene alumnos inscriptos en la fecha elegida')
  }

  // Se exige la asistencia de todos los alumnos de la sección, una sola vez cada uno
  const enrolledIds = new Set(enrolledStudents.map(({ studentId }) => studentId))
  const recordIds = new Set(records.map(({ studentId }) => studentId))
  const allBelongToSection = records.every(({ studentId }) => enrolledIds.has(studentId))

  if (!allBelongToSection || recordIds.size !== records.length || records.length !== enrolledIds.size) {
    throw new HttpError(409, 'Hay que registrar la asistencia de todos los alumnos de la sección')
  }

  const existingRecords = await prisma.dailyAttendance.findMany({
    where: { sectionId, date: parsedDate },
    select: { studentId: true, value: true, justified: true, justification: true },
  })
  const previousRecords = new Map(existingRecords.map((record) => [record.studentId, record]))

  // registeredById guarda quién hizo el último cambio (también al corregir un día anterior)
  const saved = await prisma.$transaction(
    records.map((record) => {
      const justification = justificationData(record, previousRecords.get(record.studentId))
      return prisma.dailyAttendance.upsert({
        where: {
          studentId_date_sectionId: { studentId: record.studentId, date: parsedDate, sectionId },
        },
        create: {
          studentId: record.studentId,
          date: parsedDate,
          sectionId,
          registeredById,
          value: record.value,
          justified: record.justified ?? false,
          justification: record.justified ? DAILY_JUSTIFICATION : null,
        },
        update: { value: record.value, registeredById, ...justification },
      })
    })
  )

  return { saved: saved.length }
}

// La justificación posterior (por ejemplo, con certificado) se puede cargar cualquier día,
// para inasistencias y retardos: no modifica la falta, solo la marca como justificada (E1-RF-10)
export async function justifyAttendance(id: string, justification: string) {
  const attendance = await prisma.dailyAttendance.findUnique({
    where: { id },
    select: { value: true, justified: true },
  })

  if (!attendance) throw new HttpError(404, 'Registro de asistencia no encontrado')
  if (attendance.value === AttendanceValue.PRESENT) {
    throw new HttpError(409, 'No se puede justificar una asistencia presente')
  }
  if (attendance.justified) throw new HttpError(409, 'Ya está justificada')

  return prisma.dailyAttendance.update({
    where: { id },
    data: { justified: true, justification },
  })
}

function buildAttendanceWhere(filters: PaginationAttendanceFilters): Prisma.DailyAttendanceWhereInput {
  const { studentId, search, sectionId, from, to, value, justified } = filters
  return {
    ...(studentId && { studentId }),
    ...(sectionId && { sectionId }),
    ...(search && {
      student: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { dni: { contains: search } },
        ],
      },
    }),
    ...(value && { value }),
    ...(justified !== undefined && { justified }),
    ...((from || to) && {
      date: {
        ...(from && { gte: toDate(from) }),
        ...(to && { lte: toDate(to) }),
      },
    }),
  }
}

export async function listAttendances(filters: PaginationAttendanceFilters) {
  const { page = 1, pageSize = 20 } = filters
  const where = buildAttendanceWhere(filters)
  const [attendances, total] = await prisma.$transaction([
    prisma.dailyAttendance.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
      select: { id: true, date: true, value: true, justified: true, justification: true },
    }),
    prisma.dailyAttendance.count({ where }),
  ])

  return {
    items: attendances.map((attendance) => ({
      ...attendance,
      date: toDay(attendance.date),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

type SummaryRecord = {
  studentId: string
  sectionId: string
  student: string
  dni: string
  course: string
  // Columnas del wireframe: total = presentes + ausentes + justificadas + retardos
  totalClasses: number
  presents: number
  absences: number // Ausentes sin justificar
  justified: number // Inasistencias y retardos justificados
  lateArrivals: number // Retardos (¼ o ½) sin justificar
  attendancePercentage: number
  // Faltas computables para el tope institucional: solo lo NO justificado (1, ½ y ¼)
  weightedAbsences: number
  justifications: Array<{ id: string; date: string; type: 'ausente' | 'media' | 'cuarto'; reason: string }>
  attendanceRecords: Array<{
    id: string
    date: string
    value: AttendanceValue
    justified: boolean
    justification: string | null
  }>
}

type SummaryPeriod = 'FULL' | 'FIRST' | 'SECOND'

// Fechas y días hábiles del período elegido, según el ciclo lectivo activo.
// Si el ciclo no tiene cargadas las fechas de los cuatrimestres, se usan marzo-julio y agosto-diciembre.
async function periodInfo(period: SummaryPeriod) {
  const academicYear = await prisma.academicYear.findFirst({ where: { active: true } })
  if (!academicYear) throw new HttpError(404, 'No hay un ciclo lectivo activo')

  const year = academicYear.year
  const firstStart = academicYear.term1StartDate ?? toDate(`${year}-03-01`)
  const firstEnd = academicYear.term1EndDate ?? toDate(`${year}-07-31`)
  const secondStart = academicYear.term2StartDate ?? toDate(`${year}-08-01`)
  const secondEnd = academicYear.term2EndDate ?? toDate(`${year}-12-31`)

  if (period === 'FIRST') {
    return { range: { gte: firstStart, lte: firstEnd }, schoolDays: academicYear.term1SchoolDays }
  }
  if (period === 'SECOND') {
    return { range: { gte: secondStart, lte: secondEnd }, schoolDays: academicYear.term2SchoolDays }
  }
  return { range: { gte: firstStart, lte: secondEnd }, schoolDays: academicYear.totalSchoolDays }
}

const JUSTIFICATION_TYPE: Record<Exclude<AttendanceValue, 'PRESENT'>, 'ausente' | 'media' | 'cuarto'> = {
  ABSENT: 'ausente',
  HALF: 'media',
  QUARTER: 'cuarto',
}

function emptySummary(
  student: { id: string; firstName: string; lastName: string; dni: string },
  section: { id: string; grade: number; division: string }
): SummaryRecord {
  return {
    studentId: student.id,
    sectionId: section.id,
    student: `${student.lastName}, ${student.firstName}`,
    dni: student.dni,
    course: `${section.grade}° Año Sección ${section.division}`,
    totalClasses: 0,
    presents: 0,
    absences: 0,
    justified: 0,
    lateArrivals: 0,
    attendancePercentage: 0,
    weightedAbsences: 0,
    justifications: [],
    attendanceRecords: [],
  }
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// Resumen por alumno del ciclo lectivo activo.
// El total de clases son los días con asistencia tomada, y el porcentaje es presentes / total de clases.
// Al filtrar por curso, aparecen todos los inscriptos, aunque todavía no tengan asistencia cargada.
export async function getAttendanceSummary(filters: PaginationAttendanceFilters) {
  const { page = 1, pageSize = 20, period = 'FULL' } = filters
  const { range, schoolDays } = await periodInfo(period)

  const attendances = await prisma.dailyAttendance.findMany({
    where: {
      ...buildAttendanceWhere({ ...filters, from: undefined, to: undefined }),
      date: range,
      section: { academicYear: { active: true } },
    },
    include: { student: true, section: true },
    orderBy: [{ date: 'asc' }],
  })

  const grouped = new Map<string, SummaryRecord>()

  for (const attendance of attendances) {
    const key = `${attendance.studentId}:${attendance.sectionId}`
    const current = grouped.get(key) ?? emptySummary(attendance.student, attendance.section)

    current.totalClasses += 1

    if (attendance.value === AttendanceValue.PRESENT) {
      current.presents += 1
    } else {
      // Lo justificado (inasistencias y retardos) se descuenta de las faltas computables
      if (attendance.justified) current.justified += 1
      else if (isLateArrival(attendance.value)) current.lateArrivals += 1
      else current.absences += 1

      if (!attendance.justified) current.weightedAbsences += WEIGHT[attendance.value]

      const date = toDay(attendance.date)
      current.attendanceRecords.push({
        id: attendance.id,
        date,
        value: attendance.value,
        justified: attendance.justified,
        justification: attendance.justification,
      })

      if (attendance.justified && attendance.justification) {
        current.justifications.push({
          id: attendance.id,
          date,
          type: JUSTIFICATION_TYPE[attendance.value],
          reason: attendance.justification,
        })
      }
    }

    grouped.set(key, current)
  }

  // Filtrando por curso: se suman los inscriptos del período que no tienen ningún registro
  if (filters.sectionId) {
    const section = await prisma.classSection.findUnique({
      where: { id: filters.sectionId },
      select: { id: true, grade: true, division: true },
    })
    if (section) {
      const enrollments = await prisma.enrollmentHistory.findMany({
        where: {
          classSectionId: section.id,
          startDate: { lte: range.lte },
          OR: [{ endDate: null }, { endDate: { gte: range.gte } }],
        },
        select: { student: { select: { id: true, firstName: true, lastName: true, dni: true } } },
      })
      const search = normalize(filters.search ?? '')
      for (const { student } of enrollments) {
        const key = `${student.id}:${section.id}`
        const matches =
          !search || normalize(`${student.lastName} ${student.firstName} ${student.dni}`).includes(search)
        if (!grouped.has(key) && matches) grouped.set(key, emptySummary(student, section))
      }
    }
  }

  const allItems = [...grouped.values()]
    .map((item) => ({
      ...item,
      weightedAbsences: Math.round(item.weightedAbsences * 100) / 100,
      attendancePercentage:
        item.totalClasses > 0 ? Math.round((item.presents / item.totalClasses) * 1000) / 10 : 0,
    }))
    .sort((left, right) => left.student.localeCompare(right.student, 'es'))

  const total = allItems.length
  const items = allItems.slice((page - 1) * pageSize, page * pageSize)

  return {
    items,
    // Días hábiles del período, si la dirección ya los cargó (null si no)
    schoolDays,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

// Días hábiles de un ciclo lectivo (modal de días hábiles)
export async function getSchoolDays(year: number) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { year },
    select: { year: true, term1SchoolDays: true, term2SchoolDays: true, totalSchoolDays: true },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')
  return academicYear
}

export async function updateSchoolDays(input: UpdateSchoolDaysInput) {
  await getSchoolDays(input.year)
  return prisma.academicYear.update({
    where: { year: input.year },
    data: {
      term1SchoolDays: input.term1SchoolDays,
      term2SchoolDays: input.term2SchoolDays,
      totalSchoolDays: input.totalSchoolDays,
    },
    select: { year: true, term1SchoolDays: true, term2SchoolDays: true, totalSchoolDays: true },
  })
}