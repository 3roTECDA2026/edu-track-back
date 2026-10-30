import {
  IntensificationModel,
  IntensificationResultCode,
  PendingSubjectStatus,
  Prisma,
  Role,
  Shift,
  SubjectStatus,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  MODELS_WITH_LOCATION,
  type AssignIntensificationsInput,
  type CandidatesQuery,
  type ListIntensificationsQuery,
  type RegisterResultInput,
  type UpdatePlacementInput,
} from '@/schemas/intensification.schema'
import { HttpError } from '@/utils/httpError'

type SectionInfo = { id: string; grade: number; division: string; shift: Shift }

const studentSelect = { id: true, firstName: true, lastName: true, dni: true } as const

const intensificationInclude = {
  enrollment: {
    select: {
      student: { select: studentSelect },
      subject: { select: { id: true, name: true, gradeLevel: true } },
      originalGradeLevel: true,
      pendingSubject: { select: { id: true, status: true } },
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

// Modelo y ubicación (E3-RF-06 y 07): en los modelos 2 y 3, la sección tiene que ser del año de la
// materia; en el 2, del mismo turno del alumno, y en el 3, de otro turno (contraturno).
async function assertPlacement(
  model: IntensificationModel,
  targetClassSectionId: string | null | undefined,
  subjectGradeLevel: number,
  studentShift: Shift | undefined
) {
  if (!MODELS_WITH_LOCATION.includes(model) || !targetClassSectionId) return

  const section = await prisma.classSection.findUnique({
    where: { id: targetClassSectionId },
    select: { grade: true, shift: true },
  })
  if (!section) throw new HttpError(404, 'La sección elegida no existe')
  if (section.grade !== subjectGradeLevel) {
    throw new HttpError(409, `La sección tiene que ser de ${subjectGradeLevel}° año, el año de la materia`)
  }
  if (studentShift && model === IntensificationModel.MODEL_2 && section.shift !== studentShift) {
    throw new HttpError(409, 'En el modelo 2 la sección tiene que ser del mismo turno del alumno')
  }
  if (studentShift && model === IntensificationModel.MODEL_3 && section.shift === studentShift) {
    throw new HttpError(409, 'En el modelo 3 la sección tiene que ser de otro turno (contraturno)')
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
    pendingKnowledge: item.pendingKnowledge,
    knowledgeAtClose: item.knowledgeAtClose,
    evaluationDate: item.evaluationDate,
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

  const sections = await currentSections(pendings.map((pending) => pending.studentId))

  // Solo se asigna una materia que el alumno tiene pendiente, y una sola vez por período
  for (const pending of pendings) {
    if (pending.subjectId !== input.subjectId) {
      throw new HttpError(409, 'Alguna de las materias elegidas no corresponde a esta materia')
    }
    if (pending.status !== PendingSubjectStatus.PENDING) {
      throw new HttpError(409, 'Alguna de las materias elegidas ya está acreditada')
    }
    if (pending.originEnrollment.intensifications.length > 0) {
      throw new HttpError(409, 'Algún alumno ya está asignado a este período en esta materia')
    }
    const gradeLevel =
      pending.originEnrollment.originalGradeLevel ?? pending.originEnrollment.subject.gradeLevel
    await assertPlacement(
      input.model,
      input.targetClassSectionId,
      gradeLevel,
      sections.get(pending.studentId)?.shift
    )
  }

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
  const sections = await currentSections([student.id])
  await assertPlacement(
    input.model,
    input.targetClassSectionId,
    intensification.enrollment.originalGradeLevel ?? subject.gradeLevel,
    sections.get(student.id)?.shift
  )

  const updated = await prisma.intensification.update({
    where: { id },
    data: { model: input.model, targetClassSectionId: input.targetClassSectionId ?? null },
    include: intensificationInclude,
  })
  return toIntensificationResponse(updated, sections)
}

// Quita una asignación, mientras no tenga resultado cargado
export async function removeIntensification(id: string) {
  const intensification = await findIntensificationOrFail(id)
  if (intensification.resultCode) {
    throw new HttpError(409, 'La intensificación ya tiene resultado: no se puede quitar')
  }
  await prisma.intensification.delete({ where: { id } })
  return { deleted: true }
}

// Carga del resultado de la intensificación (E3-RF-08).
// AA con nota de 4 a 10: la materia queda acreditada, sale de las MPAA y se actualiza su
// calificación final. CCA o CSA: la materia sigue pendiente y continúa intensificando.
// Puede cargarlo el docente responsable (solo sus alumnos), la dirección o la administración.
export async function registerResult(
  id: string,
  input: RegisterResultInput,
  user: { userId: string; role: Role }
) {
  const intensification = await findIntensificationOrFail(id)

  if (user.role === Role.TEACHER && intensification.responsibleTeacherId !== user.userId) {
    throw new HttpError(403, 'Solo el docente responsable o la dirección pueden cargar este resultado')
  }
  if (intensification.resultCode === IntensificationResultCode.AA) {
    throw new HttpError(409, 'La materia ya se acreditó con esta intensificación: el resultado no se cambia')
  }
  const pending = intensification.enrollment.pendingSubject
  if (pending?.status === PendingSubjectStatus.ACCREDITED) {
    throw new HttpError(409, 'La materia ya está acreditada')
  }

  const approved = input.resultCode === IntensificationResultCode.AA
  const score = input.score ?? null
  const now = new Date()
  const subjectStatus = approved
    ? SubjectStatus.APPROVED_ACCREDITED
    : SubjectStatus.CONTINUES_INTENSIFYING

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.intensification.update({
      where: { id },
      data: {
        resultCode: input.resultCode,
        score,
        knowledgeAtClose: input.knowledgeAtClose ?? null,
        // Con CCA o CSA se actualizan los saberes que le quedan; con AA se conservan los del intento
        ...(!approved && input.pendingKnowledge !== undefined && {
          pendingKnowledge: input.pendingKnowledge,
        }),
        evaluationDate: now,
      },
    })

    // La materia aprobada sale de las MPAA, con la nota de la intensificación
    if (approved && pending) {
      await tx.pendingSubject.update({
        where: { id: pending.id },
        data: { status: PendingSubjectStatus.ACCREDITED, finalScore: score, accreditedAt: now },
      })
    }

    // Calificación de la materia: nota final y estado (si no tenía calificación, se crea)
    await tx.grade.upsert({
      where: { enrollmentId: intensification.enrollmentId },
      update: { subjectStatus, ...(approved && { finalScore: score }) },
      create: {
        enrollmentId: intensification.enrollmentId,
        subjectStatus,
        ...(approved && { finalScore: score }),
      },
    })
  })

  const updated = await findIntensificationOrFail(id)
  const sections = await currentSections([updated.enrollment.student.id])
  return toIntensificationResponse(updated, sections)
}