import { AttendanceValue, Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Función auxiliar para convertir string de fecha a Date UTC
const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`)

// Pesos de las inasistencias para los cálculos del resumen
const WEIGHT: Record<AttendanceValue, number> = {
  PRESENT: 0,
  ABSENT: 1,
  HALF: 0.5,
  QUARTER: 0.25,
}

// 1. Servicio para registrar asistencia en lote con validación estricta
export async function saveBatchAttendance(data: {
  date: string
  sectionId: string
  registeredById: string
  records: Array<{ studentId: string; value: AttendanceValue }>
}) {
  const { date, sectionId, registeredById, records } = data
  const parsedDate = toDate(date)

  // Buscamos los estudiantes activos inscriptos en esta sección a través del historial
  const historyEntries = await prisma.enrollmentHistory.findMany({
    where: {
      classSectionId: sectionId,
      endDate: null, // Solo los alumnos que están cursando actualmente en la sección
    },
    select: { studentId: true },
  })

  const enrolledStudents = historyEntries.map((e) => ({ id: e.studentId }))

  if (enrolledStudents.length === 0) {
    throw new Error('No hay estudiantes inscriptos activos en esta sección.')
  }

  // Validamos estrictamente que la cantidad enviada coincida con el total del curso
  if (records.length !== enrolledStudents.length) {
    throw new Error(
      `Faltan estudiantes por registrar. La sección tiene ${enrolledStudents.length} alumnos inscriptos y se recibieron ${records.length} registros.`
    )
  }

  // Validamos que los IDs enviados pertenezcan efectivamente a esta sección
  const enrolledIds = new Set(enrolledStudents.map((s) => s.id))
  const allBelongToSection = records.every((r) => enrolledIds.has(r.studentId))

  if (!allBelongToSection) {
    throw new Error(
      'Se intentó registrar asistencia de estudiantes que no pertenecen a esta sección.'
    )
  }

  // Si pasa todas las validaciones, guardamos todo de forma segura en la transacción
  return prisma.$transaction(
    records.map((record) =>
      prisma.dailyAttendance.upsert({
        where: {
          studentId_date_sectionId: {
            studentId: record.studentId,
            date: parsedDate,
            sectionId,
          },
        },
        create: {
          studentId: record.studentId,
          date: parsedDate,
          sectionId,
          registeredById,
          value: record.value,
        },
        update: {
          value: record.value,
          registeredById,
        },
      })
    )
  )
}

// 2. Servicio para justificar una inasistencia específica
export async function justifyAttendance(id: string, justification: string) {
  return prisma.dailyAttendance.update({
    where: { id },
    data: {
      justified: true,
      justification,
    },
  })
}

// 3. Servicio para obtener el resumen de inasistencias (utilizado en AttendanceSummaryPage)
export async function getAttendanceSummary(filters: any) {
  const {
    page = 1,
    pageSize = 20,
    studentId,
    search,
    sectionId,
    from,
    to,
    value,
    justified,
  } = filters

  const where: Prisma.DailyAttendanceWhereInput = {
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

  const attendances = await prisma.dailyAttendance.findMany({
    where,
    include: { student: true, section: true },
    orderBy: { date: 'desc' },
  })

  // Agrupamos los datos por alumno para devolver el resumen que espera la pantalla
  const grouped = new Map<string, any>()

  for (const attendance of attendances) {
    const current = grouped.get(attendance.studentId) ?? {
      studentId: attendance.studentId,
      student: `${attendance.student.lastName}, ${attendance.student.firstName}`,
      dni: attendance.student.dni,
      sectionId: attendance.sectionId,
      course: `${attendance.section.grade}° Año Sección ${attendance.section.division}`,
      date: attendance.date.toISOString().slice(0, 10),
      absences: 0,
      halfAbsences: 0,
      quarterAbsences: 0,
      total: 0,
      justified: 0,
      unjustified: 0,
      justifications: [],
    }

    const weight = WEIGHT[attendance.value]
    if (attendance.value === AttendanceValue.ABSENT) current.absences += 1
    if (attendance.value === AttendanceValue.HALF) current.halfAbsences += 1
    if (attendance.value === AttendanceValue.QUARTER) current.quarterAbsences += 1

    current.total += weight
    if (attendance.justified) current.justified += weight
    else current.unjustified += weight

    if (attendance.justified && attendance.justification) {
      const type =
        attendance.value === AttendanceValue.HALF
          ? 'media'
          : attendance.value === AttendanceValue.QUARTER
            ? 'cuarto'
            : 'ausente'
      current.justifications.push({
        id: attendance.id,
        date: attendance.date.toISOString().slice(0, 10),
        type,
        reason: attendance.justification,
      })
    }
    grouped.set(attendance.studentId, current)
  }

  const allItems = [...grouped.values()].sort((left, right) => right.total - left.total)
  const total = allItems.length
  const items = allItems.slice((page - 1) * pageSize, page * pageSize)

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
