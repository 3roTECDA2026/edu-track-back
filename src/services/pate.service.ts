import {
  IntensificationModel,
  type OrganizationalModel,
  PendingSubjectStatus,
  Prisma,
  type Shift,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { PateSubjectToIntensify, PateSubjectToRepeat } from '@/schemas/pate.schema'
import { assertPlacement } from '@/utils/intensificationPlacement'

// PATE (E4-RF-06, RN-012 y RN-013, CRM-078)

type DbClient = Prisma.TransactionClient | typeof prisma

// Máximo de materias por ciclo, cursadas y recursadas (A5, incs. 14 a 16; RN-013).
// Provisorio hasta que se fusione CRM-061 (PR #57): entonces se usa su assertSubjectLimit.
const MAX_SUBJECTS_PER_CYCLE = 12

// Modelos de intensificación de cada opción organizativa (A5, Cuadro 2).
// Provisorio hasta que se fusione el PR #60: entonces se usa su MODELS_BY_OPTION.
const MODELS_BY_OPTION: Record<OrganizationalModel, IntensificationModel[]> = {
  OPTION_A: [IntensificationModel.MODEL_1, IntensificationModel.MODEL_2],
  OPTION_B: [IntensificationModel.MODEL_1, IntensificationModel.MODEL_3],
  OPTION_C: [
    IntensificationModel.MODEL_1,
    IntensificationModel.MODEL_2,
    IntensificationModel.MODEL_3,
  ],
  OPTION_D: [IntensificationModel.MODEL_1, IntensificationModel.MODEL_4],
}

const modelNumber = (model: IntensificationModel) => model.replace('MODEL_', '')

// Modelos que puede usar la escuela según su opción organizativa. Sin opción elegida, los cuatro.
export async function allowedModels(db: DbClient = prisma) {
  const config = await db.institutionalConfig.findUnique({
    where: { singleton: true },
    select: { organizationalModel: true },
  })
  return {
    option: config?.organizationalModel ?? null,
    models: config
      ? MODELS_BY_OPTION[config.organizationalModel]
      : Object.values(IntensificationModel),
  }
}

// Materias del alumno en el ciclo (cursadas y recursadas). Provisorio hasta CRM-061.
export function countSubjectsInCycle(db: DbClient, studentId: string, academicYearId: string) {
  return db.enrollment.count({ where: { studentId, academicYearId } })
}

// Turno del alumno en el ciclo (su inscripción abierta a una división), para los modelos 2 y 3
export async function studentShiftInCycle(
  db: DbClient,
  studentId: string,
  academicYearId: string
): Promise<Shift | undefined> {
  const history = await db.enrollmentHistory.findFirst({
    where: { studentId, endDate: null, classSection: { academicYearId } },
    orderBy: { startDate: 'desc' },
    select: { classSection: { select: { shift: true } } },
  })
  return history?.classSection.shift
}

interface PateSubjectsInput {
  studentId: string
  academicYear: { id: string; year: number }
  subjectsToIntensify: PateSubjectToIntensify[]
  subjectsToRepeat: PateSubjectToRepeat[]
}

// Valida las materias del PATE y devuelve todos los errores juntos (vacío si está todo bien):
// - que sean MPAA pendientes del alumno, de ciclos anteriores (criterio 4);
// - que el modelo esté entre los de la opción organizativa de la escuela;
// - en los modelos 2 y 3, la sección: del ciclo, del año de la materia y del turno que
//   corresponde (mismas reglas que la asignación de CRM-056);
// - en las recursadas, la sección: del ciclo y del año de la materia (el turno puede ser otro);
// - que cursadas + recursadas no pasen de 12 en el ciclo (criterio 3).
// El máximo de 4 a intensificar y que cada materia vaya una sola vez los valida el schema.
export async function validatePateSubjects(db: DbClient, input: PateSubjectsInput) {
  const errors: string[] = []
  const { studentId, academicYear, subjectsToIntensify, subjectsToRepeat } = input

  const pendingIds = [
    ...subjectsToIntensify.map((item) => item.pendingSubjectId),
    ...subjectsToRepeat.map((item) => item.pendingSubjectId),
  ]
  const sectionIds = [
    ...subjectsToIntensify.flatMap((item) =>
      item.targetClassSectionId ? [item.targetClassSectionId] : []
    ),
    ...subjectsToRepeat.map((item) => item.classSectionId),
  ]

  const [pendings, sections, models, studentShift, currentSubjects] = await Promise.all([
    db.pendingSubject.findMany({
      where: { id: { in: pendingIds } },
      select: {
        id: true,
        studentId: true,
        status: true,
        subject: { select: { name: true, gradeLevel: true } },
        originAcademicYear: { select: { year: true } },
        originEnrollment: { select: { originalGradeLevel: true } },
      },
    }),
    db.classSection.findMany({
      where: { id: { in: sectionIds } },
      select: { id: true, grade: true, division: true, shift: true, academicYearId: true },
    }),
    allowedModels(db),
    studentShiftInCycle(db, studentId, academicYear.id),
    countSubjectsInCycle(db, studentId, academicYear.id),
  ])

  const pendingById = new Map(pendings.map((pending) => [pending.id, pending]))
  const sectionById = new Map(sections.map((section) => [section.id, section]))

  // MPAA del alumno: devuelve nombre y año de la materia, o null si no sirve
  const checkPending = (pendingSubjectId: string) => {
    const pending = pendingById.get(pendingSubjectId)
    if (!pending) {
      errors.push('Alguna de las materias elegidas no existe')
      return null
    }
    const name = pending.subject.name
    if (pending.studentId !== studentId) {
      errors.push(`${name} no es una materia pendiente de este alumno`)
      return null
    }
    if (pending.status !== PendingSubjectStatus.PENDING) {
      errors.push(`${name} ya está acreditada`)
      return null
    }
    if (pending.originAcademicYear.year >= academicYear.year) {
      errors.push(`${name} no es de un ciclo anterior al ${academicYear.year}`)
      return null
    }
    return {
      name,
      gradeLevel: pending.originEnrollment.originalGradeLevel ?? pending.subject.gradeLevel,
    }
  }

  // Sección del ciclo del PATE
  const checkSection = (sectionId: string, name: string) => {
    const section = sectionById.get(sectionId)
    if (!section) {
      errors.push(`${name}: la sección elegida no existe`)
      return null
    }
    if (section.academicYearId !== academicYear.id) {
      errors.push(`${name}: la sección tiene que ser del ciclo ${academicYear.year}`)
      return null
    }
    return section
  }

  for (const item of subjectsToIntensify) {
    const subject = checkPending(item.pendingSubjectId)
    if (!subject) continue
    if (!models.models.includes(item.model)) {
      errors.push(
        `${subject.name}: el modelo ${modelNumber(item.model)} no está entre los de la opción organizativa de la escuela (${models.models.map(modelNumber).join(', ')})`
      )
      continue
    }
    if (!item.targetClassSectionId) continue
    const section = checkSection(item.targetClassSectionId, subject.name)
    if (!section) continue
    // Mismas reglas que la asignación de CRM-056; se juntan los mensajes en lugar de cortar
    try {
      assertPlacement(item.model, section, subject.gradeLevel, studentShift, subject.name)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  for (const item of subjectsToRepeat) {
    const subject = checkPending(item.pendingSubjectId)
    if (!subject) continue
    const section = checkSection(item.classSectionId, subject.name)
    if (!section) continue
    if (section.grade !== subject.gradeLevel) {
      errors.push(`${subject.name}: se recursa en ${subject.gradeLevel}° año, el año de la materia`)
    }
  }

  // Cursadas + recursadas del ciclo: las del PATE todavía no tienen inscripción
  const total = currentSubjects + subjectsToRepeat.length
  if (total > MAX_SUBJECTS_PER_CYCLE) {
    errors.push(
      `El alumno tiene ${currentSubjects} materias en el ciclo ${academicYear.year}; con ${subjectsToRepeat.length} a recursar serían ${total} y el máximo es ${MAX_SUBJECTS_PER_CYCLE}`
    )
  }

  return errors
}
