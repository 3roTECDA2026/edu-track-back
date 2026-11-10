import {
  AuditActionType,
  IntensificationModel,
  type OrganizationalModel,
  PateStatus,
  PendingSubjectStatus,
  Prisma,
  type Shift,
  StudentStatus,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  MAX_SUBJECTS_TO_INTENSIFY,
  type CreatePateInput,
  type ListPatesQuery,
  type PateOptionsQuery,
  type PateSubjectToIntensify,
  type PateSubjectToRepeat,
  type UpdatePateInput,
} from '@/schemas/pate.schema'
import { HttpError } from '@/utils/httpError'
import { assertPlacement } from '@/utils/intensificationPlacement'
import { toDay } from '@/utils/schoolDate'

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

// ============================================================
// Alta, edición, listado y detalle
// ============================================================

// Quién hace el cambio (del token) y desde qué IP, para la auditoría
interface Actor {
  userId: string
  ipAddress: string
}

const ENROLLED_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL]
const MIN_PENDING_TO_REFER = 5 // RN-012: 5 o más MPAA

const sectionSelect = { select: { id: true, grade: true, division: true, shift: true } } as const
const pendingSelect = {
  select: {
    id: true,
    subject: { select: { id: true, name: true, gradeLevel: true } },
    originAcademicYear: { select: { year: true } },
    originEnrollment: { select: { originalGradeLevel: true } },
  },
} as const

const pateInclude = {
  academicYear: { select: { id: true, year: true } },
  student: { select: { id: true, firstName: true, lastName: true, dni: true } },
  edteMeeting: { select: { id: true, date: true, period: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  subjectsToIntensify: {
    include: { pendingSubject: pendingSelect, targetClassSection: sectionSelect },
  },
  subjectsToRepeat: { include: { pendingSubject: pendingSelect, classSection: sectionSelect } },
} satisfies Prisma.PateInclude

type PateWithRelations = Prisma.PateGetPayload<{ include: typeof pateInclude }>
type PendingInfo = PateWithRelations['subjectsToIntensify'][number]['pendingSubject']

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.lastName}, ${person.firstName}`

const toPendingInfo = (pending: PendingInfo) => ({
  pendingSubjectId: pending.id,
  subjectId: pending.subject.id,
  subjectName: pending.subject.name,
  gradeLevel: pending.originEnrollment.originalGradeLevel ?? pending.subject.gradeLevel,
  originYear: pending.originAcademicYear.year,
})

const bySubjectName = (a: { subjectName: string }, b: { subjectName: string }) =>
  a.subjectName.localeCompare(b.subjectName, 'es')

function toPateResponse(pate: PateWithRelations) {
  return {
    id: pate.id,
    year: pate.academicYear.year,
    status: pate.status,
    student: pate.student,
    edteMeeting: pate.edteMeeting
      ? {
          id: pate.edteMeeting.id,
          date: toDay(pate.edteMeeting.date),
          period: pate.edteMeeting.period,
        }
      : null,
    diagnosis: pate.diagnosis,
    supportStrategies: pate.supportStrategies,
    schedule: pate.schedule,
    notificationUrl: pate.notificationUrl,
    createdBy: pate.createdBy ? { id: pate.createdBy.id, name: fullName(pate.createdBy) } : null,
    createdAt: pate.createdAt,
    updatedAt: pate.updatedAt,
    subjectsToIntensify: pate.subjectsToIntensify
      .map((item) => ({
        id: item.id,
        ...toPendingInfo(item.pendingSubject),
        model: item.model,
        targetClassSection: item.targetClassSection,
      }))
      .sort(bySubjectName),
    subjectsToRepeat: pate.subjectsToRepeat
      .map((item) => ({
        id: item.id,
        ...toPendingInfo(item.pendingSubject),
        classSection: item.classSection,
        repeatEnrollmentId: item.repeatEnrollmentId,
      }))
      .sort(bySubjectName),
  }
}

async function findPateOrFail(id: string, db: DbClient = prisma) {
  const pate = await db.pate.findUnique({ where: { id }, include: pateInclude })
  if (!pate) throw new HttpError(404, 'PATE no encontrado')
  return pate
}

// Alumnos derivados al EDTE al cierre del ciclo anterior: 5 o más MPAA pendientes (RN-012).
// Provisorio: CRM-075 tiene la misma función (getReferredStudentIds en edteMeeting.service) y
// CRM-073 la reemplaza por su listado de derivación. Cuando estén en develop, se unifica.
async function getReferredStudentIds(closedYear: number, studentIds: string[]) {
  const groups = await prisma.pendingSubject.groupBy({
    by: ['studentId'],
    where: {
      studentId: { in: studentIds },
      status: PendingSubjectStatus.PENDING,
      originAcademicYear: { year: { lte: closedYear } },
    },
    _count: { _all: true },
    having: { studentId: { _count: { gte: MIN_PENDING_TO_REFER } } },
  })
  return groups.map((group) => group.studentId)
}

// Ciclo del PATE: el de la reunión del EDTE, si viene; si no, el ciclo activo
async function resolvePateCycle(edteMeetingId: string | null | undefined) {
  if (edteMeetingId) {
    const meeting = await prisma.edteMeeting.findUnique({
      where: { id: edteMeetingId },
      select: { id: true, academicYear: { select: { id: true, year: true } } },
    })
    if (!meeting) throw new HttpError(404, 'Reunión del EDTE no encontrada')
    return { meetingId: meeting.id, academicYear: meeting.academicYear }
  }
  const active = await prisma.academicYear.findFirst({
    where: { active: true },
    orderBy: { year: 'desc' },
    select: { id: true, year: true },
  })
  if (!active) throw new HttpError(409, 'No hay un ciclo lectivo activo')
  return { meetingId: null, academicYear: active }
}

// Si hay errores en las materias, se devuelven todos juntos (en details.errors)
function throwIfErrors(errors: string[]) {
  if (errors.length > 0) {
    throw new HttpError(409, 'Revisá las materias del PATE', { errors })
  }
}

// El alumno tiene que estar derivado al EDTE al cierre del ciclo anterior (RN-012)
async function assertReferred(studentId: string, year: number, studentName: string) {
  const referred = await getReferredStudentIds(year - 1, [studentId])
  if (!referred.includes(studentId)) {
    throw new HttpError(
      409,
      `${studentName} no está derivado al EDTE: hacen falta ${MIN_PENDING_TO_REFER} o más materias pendientes`
    )
  }
}

// Resumen de las materias para la auditoría
const auditSubjects = (data: {
  subjectsToIntensify: { pendingSubjectId: string; model: IntensificationModel }[]
  subjectsToRepeat: { pendingSubjectId: string }[]
}) => ({
  subjectsToIntensify: data.subjectsToIntensify.map((item) => ({
    pendingSubjectId: item.pendingSubjectId,
    model: item.model,
  })),
  subjectsToRepeat: data.subjectsToRepeat.map((item) => item.pendingSubjectId),
})

// Listado: por alumno, ciclo o estado
export async function listPates(query: ListPatesQuery) {
  const pates = await prisma.pate.findMany({
    where: {
      ...(query.studentId && { studentId: query.studentId }),
      ...(query.year !== undefined && { academicYear: { year: query.year } }),
      ...(query.status && { status: query.status }),
    },
    include: pateInclude,
    orderBy: [{ academicYear: { year: 'desc' } }, { student: { lastName: 'asc' } }],
  })
  return pates.map(toPateResponse)
}

export async function getPate(id: string) {
  return toPateResponse(await findPateOrFail(id))
}

// Alta en borrador. El ciclo es el de la reunión del EDTE, si viene; si no, el ciclo activo.
// Cuando esté CRM-075, la reunión pasa a ser obligatoria y se valida que el alumno esté entre
// sus alumnos tratados.
export async function createPate(input: CreatePateInput, actor: Actor) {
  const [student, cycle] = await Promise.all([
    prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, firstName: true, lastName: true, status: true },
    }),
    resolvePateCycle(input.edteMeetingId),
  ])
  if (!student) throw new HttpError(404, 'Estudiante no encontrado')
  const studentName = fullName(student)
  if (!ENROLLED_STATUSES.includes(student.status)) {
    throw new HttpError(409, `${studentName} no está activo`)
  }
  const { academicYear, meetingId } = cycle
  await assertReferred(student.id, academicYear.year, studentName)

  const existing = await prisma.pate.findUnique({
    where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } },
    select: { id: true },
  })
  if (existing) {
    throw new HttpError(409, `${studentName} ya tiene un PATE en el ciclo ${academicYear.year}`)
  }

  throwIfErrors(
    await validatePateSubjects(prisma, {
      studentId: student.id,
      academicYear,
      subjectsToIntensify: input.subjectsToIntensify,
      subjectsToRepeat: input.subjectsToRepeat,
    })
  )

  try {
    const id = await prisma.$transaction(async (tx) => {
      const pate = await tx.pate.create({
        data: {
          studentId: student.id,
          academicYearId: academicYear.id,
          edteMeetingId: meetingId,
          diagnosis: input.diagnosis,
          supportStrategies: input.supportStrategies,
          schedule: input.schedule || null,
          createdById: actor.userId,
          subjectsToIntensify: {
            create: input.subjectsToIntensify.map((item) => ({
              pendingSubjectId: item.pendingSubjectId,
              model: item.model,
              targetClassSectionId: item.targetClassSectionId ?? null,
            })),
          },
          subjectsToRepeat: {
            create: input.subjectsToRepeat.map((item) => ({
              pendingSubjectId: item.pendingSubjectId,
              classSectionId: item.classSectionId,
            })),
          },
        },
        select: { id: true },
      })
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: AuditActionType.CREATE,
          affectedEntity: 'Pate',
          entityId: pate.id,
          newData: {
            studentId: student.id,
            year: academicYear.year,
            edteMeetingId: meetingId,
            ...auditSubjects(input),
          },
          ipAddress: actor.ipAddress,
        },
      })
      return pate.id
    })
    return getPate(id)
  } catch (err) {
    // Dos altas a la vez para el mismo alumno y ciclo
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, `${studentName} ya tiene un PATE en el ciclo ${academicYear.year}`)
    }
    throw err
  }
}

// Edición: solo en borrador. Las listas que vienen reemplazan a las anteriores, y se vuelven a
// validar todas las materias (pueden haber cambiado las MPAA o las inscripciones).
export async function updatePate(id: string, input: UpdatePateInput, actor: Actor) {
  const pate = await findPateOrFail(id)
  if (pate.status !== PateStatus.DRAFT) {
    throw new HttpError(409, 'El PATE ya está confirmado: no se puede modificar')
  }

  const subjectsToIntensify =
    input.subjectsToIntensify ??
    pate.subjectsToIntensify.map((item) => ({
      pendingSubjectId: item.pendingSubjectId,
      model: item.model,
      targetClassSectionId: item.targetClassSectionId,
    }))
  const subjectsToRepeat =
    input.subjectsToRepeat ??
    pate.subjectsToRepeat.map((item) => ({
      pendingSubjectId: item.pendingSubjectId,
      classSectionId: item.classSectionId,
    }))

  throwIfErrors(
    await validatePateSubjects(prisma, {
      studentId: pate.studentId,
      academicYear: pate.academicYear,
      subjectsToIntensify,
      subjectsToRepeat,
    })
  )

  await prisma.$transaction(async (tx) => {
    await tx.pate.update({
      where: { id },
      data: {
        ...(input.diagnosis !== undefined && { diagnosis: input.diagnosis }),
        ...(input.supportStrategies !== undefined && {
          supportStrategies: input.supportStrategies,
        }),
        ...(input.schedule !== undefined && { schedule: input.schedule || null }),
      },
    })
    if (input.subjectsToIntensify) {
      await tx.pateSubjectIntensify.deleteMany({ where: { pateId: id } })
      await tx.pateSubjectIntensify.createMany({
        data: input.subjectsToIntensify.map((item) => ({
          pateId: id,
          pendingSubjectId: item.pendingSubjectId,
          model: item.model,
          targetClassSectionId: item.targetClassSectionId ?? null,
        })),
      })
    }
    if (input.subjectsToRepeat) {
      await tx.pateSubjectRepeat.deleteMany({ where: { pateId: id } })
      await tx.pateSubjectRepeat.createMany({
        data: input.subjectsToRepeat.map((item) => ({
          pateId: id,
          pendingSubjectId: item.pendingSubjectId,
          classSectionId: item.classSectionId,
        })),
      })
    }
    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.UPDATE,
        affectedEntity: 'Pate',
        entityId: id,
        previousData: auditSubjects(pate),
        newData: {
          ...auditSubjects({ subjectsToIntensify, subjectsToRepeat }),
          textChanged: [input.diagnosis, input.supportStrategies, input.schedule].some(
            (value) => value !== undefined
          ),
        },
        ipAddress: actor.ipAddress,
      },
    })
  })

  return getPate(id)
}

// Datos para armar el formulario del PATE de un alumno (en el ciclo de la reunión, si viene)
export async function getPateOptions(query: PateOptionsQuery) {
  const { academicYear } = await resolvePateCycle(query.edteMeetingId)

  const [pendings, sections, models, shift, currentSubjects, referred, existing] =
    await Promise.all([
      prisma.pendingSubject.findMany({
        where: {
          studentId: query.studentId,
          status: PendingSubjectStatus.PENDING,
          originAcademicYear: { year: { lt: academicYear.year } },
        },
        ...pendingSelect,
      }),
      prisma.classSection.findMany({
        where: { academicYearId: academicYear.id },
        orderBy: [{ grade: 'asc' }, { division: 'asc' }, { shift: 'asc' }],
        ...sectionSelect,
      }),
      allowedModels(),
      studentShiftInCycle(prisma, query.studentId, academicYear.id),
      countSubjectsInCycle(prisma, query.studentId, academicYear.id),
      getReferredStudentIds(academicYear.year - 1, [query.studentId]),
      prisma.pate.findUnique({
        where: {
          studentId_academicYearId: { studentId: query.studentId, academicYearId: academicYear.id },
        },
        select: { id: true, status: true },
      }),
    ])

  return {
    year: academicYear.year,
    referred: referred.includes(query.studentId),
    existingPate: existing,
    pendingSubjects: pendings.map(toPendingInfo).sort(bySubjectName),
    sections,
    organizationalOption: models.option,
    allowedModels: models.models,
    studentShift: shift ?? null,
    currentSubjectsCount: currentSubjects,
    maxSubjectsPerCycle: MAX_SUBJECTS_PER_CYCLE,
    maxSubjectsToIntensify: MAX_SUBJECTS_TO_INTENSIFY,
  }
}

// ============================================================
// Cambio de estado
// ============================================================

// Transiciones posibles: borrador → en curso (confirmar) y en curso → cerrado
const NEXT_STATUS: Partial<Record<PateStatus, PateStatus>> = {
  [PateStatus.DRAFT]: PateStatus.IN_PROGRESS,
  [PateStatus.IN_PROGRESS]: PateStatus.CLOSED,
}

const STATUS_LABELS: Record<PateStatus, string> = {
  DRAFT: 'borrador',
  IN_PROGRESS: 'en curso',
  CLOSED: 'cerrado',
}

// Confirmar: se vuelven a validar todas las materias dentro de la transacción, con la fila del
// alumno bloqueada, para que dos pedidos a la vez no pasen el límite de 12.
// Cerrar: solo cambia el estado.
export async function changePateStatus(id: string, status: PateStatus, actor: Actor) {
  const pate = await findPateOrFail(id)
  if (NEXT_STATUS[pate.status] !== status) {
    throw new HttpError(
      409,
      `El PATE está ${STATUS_LABELS[pate.status]}: no puede pasar a ${STATUS_LABELS[status]}`
    )
  }

  await prisma.$transaction(async (tx) => {
    if (status === PateStatus.IN_PROGRESS) {
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${pate.studentId} FOR UPDATE`
      throwIfErrors(
        await validatePateSubjects(tx, {
          studentId: pate.studentId,
          academicYear: pate.academicYear,
          subjectsToIntensify: pate.subjectsToIntensify.map((item) => ({
            pendingSubjectId: item.pendingSubjectId,
            model: item.model,
            targetClassSectionId: item.targetClassSectionId,
          })),
          subjectsToRepeat: pate.subjectsToRepeat.map((item) => ({
            pendingSubjectId: item.pendingSubjectId,
            classSectionId: item.classSectionId,
          })),
        })
      )
      // CRM-082: acá se crean las inscripciones REPEAT de subjectsToRepeat (con
      // createSubjectRepeat) y se guarda cada una en repeatEnrollmentId, en esta misma
      // transacción: si alguna falla, no se confirma el PATE.
    }

    // Solo si no cambió de estado mientras tanto (dos pedidos a la vez)
    const { count } = await tx.pate.updateMany({
      where: { id, status: pate.status },
      data: { status },
    })
    if (count === 0) throw new HttpError(409, 'El PATE cambió de estado mientras tanto')

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: status === PateStatus.CLOSED ? AuditActionType.CLOSE : AuditActionType.UPDATE,
        affectedEntity: 'Pate',
        entityId: id,
        previousData: { status: pate.status },
        newData: { status },
        ipAddress: actor.ipAddress,
      },
    })
  })

  return getPate(id)
}
