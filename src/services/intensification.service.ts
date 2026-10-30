import { IntensificationModel, PendingSubjectStatus, Prisma, Shift } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  MODELS_WITH_LOCATION,
  type AssignIntensificationsInput,
  type CandidatesQuery,
  type ListIntensificationsQuery,
  type UpdatePlacementInput,
} from '@/schemas/intensification.schema'
import { HttpError } from '@/utils/httpError'

type SectionInfo = { id: string; grade: number; division: string; shift: Shift }
type TargetSection = { grade: number; shift: Shift }

const studentSelect = { id: true, firstName: true, lastName: true, dni: true } as const

const studentName = (student: { firstName: string; lastName: string }) =>
  `${student.lastName}, ${student.firstName}`

const intensificationInclude = {
  enrollment: {
    select: {
      student: { select: studentSelect },
      subject: { select: { id: true, name: true, gradeLevel: true } },
      originalGradeLevel: true,
      pendingSubject: { select: { id: true } },
    },
  },
  targetClassSection: { select: { id: true, grade: true, division: true, shift: true } },
  responsibleTeacher: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.IntensificationInclude

type IntensificationWithRelations = Prisma.IntensificationGetPayload<{
  include: typeof intensificationInclude
}>

// Curso actual de cada alumno en el ciclo activo (para mostrarlo, filtrar y validar el turno)
async function currentSections(studentIds: string[]) {
  const histories = await prisma.enrollmentHistory.findMany({
    where: {
      studentId: { in: studentIds },
      endDate: null,
      classSection: { academicYear: { active: true } },
    },
    orderBy: { startDate: 'desc' },
    select: {
      studentId: true,
      classSection: { select: { id: true, grade: true, division: true, shift: true } },
    },
  })
  const sections = new Map<string, SectionInfo>()
  for (const history of histories) {
    if (!sections.has(history.studentId)) sections.set(history.studentId, history.classSection)
  }
  return sections
}

async function findScheduleOrFail(scheduleId: string) {
  const schedule = await prisma.intensificationSchedule.findUnique({
    where: { id: scheduleId },
    include: { subjects: { select: { subjectId: true, teacherId: true } } },
  })
  if (!schedule) throw new HttpError(404, 'Período de intensificación no encontrado')
  return schedule
}

// La sección donde intensifica (modelos 2 y 3). Se busca una sola vez, porque es la misma
// para todos los alumnos que se asignan juntos.
async function findTargetSection(
  model: IntensificationModel,
  targetClassSectionId: string | null | undefined
): Promise<TargetSection | null> {
  if (!MODELS_WITH_LOCATION.includes(model) || !targetClassSectionId) return null

  const section = await prisma.classSection.findUnique({
    where: { id: targetClassSectionId },
    select: { grade: true, shift: true },
  })
  if (!section) throw new HttpError(404, 'La sección elegida no existe')
  return section
}

// Modelo y ubicación (E3-RF-06 y 07): en los modelos 2 y 3, la sección tiene que ser del año de la
// materia; en el 2, del mismo turno del alumno, y en el 3, de otro turno (contraturno).
// Si el alumno no tiene curso en el ciclo activo, no se puede validar el turno: se rechaza.
function assertPlacement(
  model: IntensificationModel,
  section: TargetSection | null,
  subjectGradeLevel: number,
  studentShift: Shift | undefined,
  name: string
) {
  if (!section) return

  if (section.grade !== subjectGradeLevel) {
    throw new HttpError(
      409,
      `${name}: la sección tiene que ser de ${subjectGradeLevel}° año, el año de la materia`
    )
  }
  if (!studentShift) {
    throw new HttpError(
      409,
      `${name} no tiene curso en el ciclo activo: no se puede validar el turno`
    )
  }
  if (model === IntensificationModel.MODEL_2 && section.shift !== studentShift) {
    throw new HttpError(409, `${name}: en el modelo 2 la sección tiene que ser de su mismo turno`)
  }
  if (model === IntensificationModel.MODEL_3 && section.shift === studentShift) {
    throw new HttpError(
      409,
      `${name}: en el modelo 3 la sección tiene que ser de otro turno (contraturno)`
    )
  }
}

function toIntensificationResponse(
  item: IntensificationWithRelations,
  sections: Map<string, SectionInfo>
) {
  const { student, subject } = item.enrollment
  return {
    id: item.id,
    pendingSubjectId: item.enrollment.pendingSubject?.id ?? null,
    student,
    subject: {
      ...subject,
      gradeLevel: item.enrollment.originalGradeLevel ?? subject.gradeLevel,
    },
    course: sections.get(student.id) ?? null,
    period: item.period,
    model: item.model,
    targetClassSection: item.targetClassSection,
    responsibleTeacher: item.responsibleTeacher
      ? {
          id: item.responsibleTeacher.id,
          name: `${item.responsibleTeacher.lastName}, ${item.responsibleTeacher.firstName}`,
        }
      : null,
    resultCode: item.resultCode,
    score: item.score,
  }
}

// Alumnos asignados a un período (E3-RF-05), con filtros por materia y curso
export async function listIntensifications(query: ListIntensificationsQuery) {
  await findScheduleOrFail(query.scheduleId)

  const items = await prisma.intensification.findMany({
    where: {
      scheduleId: query.scheduleId,
      ...(query.subjectId && { enrollment: { subjectId: query.subjectId } }),
    },
    include: intensificationInclude,
  })

  const sections = await currentSections(items.map((item) => item.enrollment.student.id))
  return items
    .map((item) => toIntensificationResponse(item, sections))
    .filter((item) => !query.classSectionId || item.course?.id === query.classSectionId)
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName, 'es'))
}

// Alumnos que tienen esa materia pendiente y todavía no están asignados a este período
export async function listCandidates(query: CandidatesQuery) {
  const schedule = await findScheduleOrFail(query.scheduleId)
  if (!schedule.subjects.some((entry) => entry.subjectId === query.subjectId)) {
    throw new HttpError(409, 'La materia no está en este período del calendario')
  }

  const pendings = await prisma.pendingSubject.findMany({
    where: {
      subjectId: query.subjectId,
      status: PendingSubjectStatus.PENDING,
      originEnrollment: { intensifications: { none: { scheduleId: query.scheduleId } } },
    },
    select: {
      id: true,
      initialPendingKnowledge: true,
      originAcademicYear: { select: { year: true } },
      student: { select: studentSelect },
    },
  })

  const sections = await currentSections(pendings.map((pending) => pending.student.id))
  return pendings
    .map((pending) => ({
      pendingSubjectId: pending.id,
      student: pending.student,
      course: sections.get(pending.student.id) ?? null,
      originYear: pending.originAcademicYear.year,
      pendingKnowledge: pending.initialPendingKnowledge,
    }))
    .filter((item) => !query.classSectionId || item.course?.id === query.classSectionId)
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName, 'es'))
}

// Asigna alumnos con esa materia pendiente a un período del calendario (E3-RF-05, 06 y 07).
// El período se copia del calendario y el docente responsable, de la materia en el calendario.
export async function assignIntensifications(input: AssignIntensificationsInput) {
  const schedule = await findScheduleOrFail(input.scheduleId)
  const scheduleSubject = schedule.subjects.find((entry) => entry.subjectId === input.subjectId)
  if (!scheduleSubject) {
    throw new HttpError(409, 'La materia no está en este período del calendario')
  }

  const pendings = await prisma.pendingSubject.findMany({
    where: { id: { in: input.pendingSubjectIds } },
    select: {
      id: true,
      studentId: true,
      subjectId: true,
      status: true,
      initialPendingKnowledge: true,
      originEnrollmentId: true,
      student: { select: { firstName: true, lastName: true } },
      originEnrollment: {
        select: {
          originalGradeLevel: true,
          subject: { select: { gradeLevel: true } },
          intensifications: { where: { scheduleId: input.scheduleId }, select: { id: true } },
        },
      },
    },
  })
  if (pendings.length !== new Set(input.pendingSubjectIds).size) {
    throw new HttpError(404, 'Alguna de las materias pendientes no existe')
  }

  // La sección es la misma para todos: se busca una sola vez, antes de recorrer a los alumnos
  const [sections, targetSection] = await Promise.all([
    currentSections(pendings.map((pending) => pending.studentId)),
    findTargetSection(input.model, input.targetClassSectionId),
  ])

  // Solo se asigna una materia que el alumno tiene pendiente, y una sola vez por período.
  // Los mensajes dicen de qué alumno se trata, para no tener que probar de a uno.
  for (const pending of pendings) {
    const name = studentName(pending.student)
    if (pending.subjectId !== input.subjectId) {
      throw new HttpError(
        409,
        `${name}: la materia pendiente elegida no corresponde a esta materia`
      )
    }
    if (pending.status !== PendingSubjectStatus.PENDING) {
      throw new HttpError(409, `${name}: la materia ya está acreditada`)
    }
    if (pending.originEnrollment.intensifications.length > 0) {
      throw new HttpError(409, `${name} ya está asignado a este período en esta materia`)
    }
    const gradeLevel =
      pending.originEnrollment.originalGradeLevel ?? pending.originEnrollment.subject.gradeLevel
    assertPlacement(
      input.model,
      targetSection,
      gradeLevel,
      sections.get(pending.studentId)?.shift,
      name
    )
  }

  try {
    const created = await prisma.$transaction(
      pendings.map((pending) =>
        prisma.intensification.create({
          data: {
            enrollmentId: pending.originEnrollmentId,
            scheduleId: schedule.id,
            period: schedule.period,
            model: input.model,
            targetClassSectionId: input.targetClassSectionId ?? null,
            responsibleTeacherId: scheduleSubject.teacherId,
            pendingKnowledge: pending.initialPendingKnowledge,
          },
        })
      )
    )
    return { assigned: created.length }
  } catch (err) {
    // La restricción única de la base (enrollmentId + scheduleId) frena los duplicados que el
    // chequeo de arriba no puede ver: por ejemplo, un doble clic o dos personas al mismo tiempo
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(
        409,
        'Algún alumno ya fue asignado a este período mientras se guardaba: actualizá el listado'
      )
    }
    throw err
  }
}

async function findIntensificationOrFail(id: string) {
  const intensification = await prisma.intensification.findUnique({
    where: { id },
    include: intensificationInclude,
  })
  if (!intensification) throw new HttpError(404, 'Asignación no encontrada')
  return intensification
}

// Cambia el modelo o la ubicación, mientras la intensificación no tenga resultado
export async function updatePlacement(id: string, input: UpdatePlacementInput) {
  const intensification = await findIntensificationOrFail(id)
  if (intensification.resultCode) {
    throw new HttpError(409, 'La intensificación ya tiene resultado: no se puede cambiar el modelo')
  }

  const { student, subject } = intensification.enrollment
  const [sections, targetSection] = await Promise.all([
    currentSections([student.id]),
    findTargetSection(input.model, input.targetClassSectionId),
  ])
  assertPlacement(
    input.model,
    targetSection,
    intensification.enrollment.originalGradeLevel ?? subject.gradeLevel,
    sections.get(student.id)?.shift,
    studentName(student)
  )

  const updated = await prisma.intensification.update({
    where: { id },
    data: { model: input.model, targetClassSectionId: input.targetClassSectionId ?? null },
    include: intensificationInclude,
  })
  return toIntensificationResponse(updated, sections)
}

// Quita una asignación, mientras no tenga resultado cargado.
// Cuando existan asistencias de intensificación (CRM-059), también se bloqueará si tiene asistencias.
export async function removeIntensification(id: string) {
  const intensification = await findIntensificationOrFail(id)
  if (intensification.resultCode) {
    throw new HttpError(409, 'La intensificación ya tiene resultado: no se puede quitar')
  }
  await prisma.intensification.delete({ where: { id } })
  return { deleted: true }
}
