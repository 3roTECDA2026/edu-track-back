import {
  AttendanceValue,
  CourseType,
  IntensificationPeriod,
  Prisma,
  RiteStatus,
  Term,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { CreateRiteInput, UpdateRiteNotesInput } from '@/schemas/rite.schema'
import { HttpError } from '@/utils/httpError'

// Datos fijos de la institución para el encabezado del RITE.
// TODO: pasarlos a InstitutionalConfig cuando el modelo tenga estos campos (CRM-042).
const INSTITUTION = {
  name: 'Escuela Normal Secundaria',
  number: '10',
  district: 'Tandil',
}

// Mismos pesos que usa el módulo de asistencia para calcular inasistencias.
// El retardo puede ser de ¼ (QUARTER) o de ½ (HALF).
const ABSENCE_WEIGHT: Record<AttendanceValue, number> = {
  PRESENT: 0,
  ABSENT: 1,
  HALF: 0.5,
  QUARTER: 0.25,
}

const riteInclude = {
  student: {
    select: { id: true, firstName: true, lastName: true, dni: true, recordNumber: true },
  },
  academicYear: true,
  signingAuthority: { select: { firstName: true, lastName: true } },
} satisfies Prisma.RiteInclude

type RiteWithRelations = Prisma.RiteGetPayload<{ include: typeof riteInclude }>
type DbClient = Prisma.TransactionClient | typeof prisma

type TermDates = {
  term1StartDate: Date | null
  term1EndDate: Date | null
  term2StartDate: Date | null
  term2EndDate: Date | null
}

// Decide a qué cuatrimestre pertenece una fecha, según las fechas del ciclo lectivo.
function getTermOf(date: Date, dates: TermDates): Term | null {
  if (dates.term1StartDate && dates.term1EndDate) {
    if (date >= dates.term1StartDate && date <= dates.term1EndDate) return Term.FIRST
  }
  if (dates.term2StartDate && dates.term2EndDate) {
    if (date >= dates.term2StartDate && date <= dates.term2EndDate) return Term.SECOND
  }
  // Si el ciclo tiene fechas cargadas y la fecha no cae en ninguna, no se cuenta.
  if (dates.term1StartDate || dates.term2StartDate) return null

  // Sin fechas cargadas: enero a julio es el 1° cuatrimestre y agosto a diciembre el 2°.
  return date.getUTCMonth() < 7 ? Term.FIRST : Term.SECOND
}

function authorityName(authority: { firstName: string; lastName: string } | null) {
  return authority ? `${authority.firstName} ${authority.lastName}` : null
}

// Resumen del registro, sin los datos del formulario.
function toRiteSummary(rite: RiteWithRelations) {
  return {
    id: rite.id,
    studentId: rite.studentId,
    academicYearId: rite.academicYearId,
    academicYear: rite.academicYear.year,
    term: rite.term,
    isPostIntensification: rite.isPostIntensification,
    status: rite.status,
    generalNotes: rite.generalNotes,
    signedAt: rite.signedAt,
    signedBy: authorityName(rite.signingAuthority),
    createdAt: rite.createdAt,
    updatedAt: rite.updatedAt,
  }
}

// Arma todos los datos del formulario RITE a partir de lo cargado en el sistema (E2-RF-14).
async function buildRiteDocument(client: DbClient, rite: RiteWithRelations) {
  const { studentId, academicYearId, term } = rite
  // El RITE post-intensificación se guarda como del 2° cuatrimestre, así que muestra el año completo.
  const isFirstTerm = term === Term.FIRST

  const [enrollmentRecord, enrollments, attendances, yearRites] = await Promise.all([
    client.enrollmentHistory.findFirst({
      where: { studentId, classSection: { academicYearId } },
      orderBy: { startDate: 'desc' },
      select: { classSection: { select: { grade: true, division: true, shift: true } } },
    }),
    client.enrollment.findMany({
      where: { studentId, academicYearId },
      include: {
        subject: { select: { name: true, gradeLevel: true } },
        grade: true,
        intensifications: { select: { period: true, score: true } },
      },
    }),
    client.dailyAttendance.findMany({
      where: { studentId, section: { academicYearId } },
      select: { date: true, value: true, justified: true },
    }),
    // Los tres RITE del ciclo (1° y 2° cuatrimestre y post-intensificación), para las notificaciones.
    client.rite.findMany({
      where: { studentId, academicYearId },
      include: { signingAuthority: { select: { firstName: true, lastName: true } } },
      orderBy: [{ term: 'asc' }, { isPostIntensification: 'asc' }],
    }),
  ])

  // El formulario lista primero las materias cursadas por primera vez (C) y después las recursadas (R).
  const subjects = enrollments
    .map((enrollment) => {
      const grade = enrollment.grade
      const intensificationScore = (period: IntensificationPeriod) =>
        enrollment.intensifications.find((item) => item.period === period)?.score ?? null

      return {
        enrollmentId: enrollment.id,
        type: (enrollment.courseType === CourseType.REPEAT ? 'R' : 'C') as 'C' | 'R',
        subjectName: enrollment.subject.name,
        gradeLevel: enrollment.originalGradeLevel ?? enrollment.subject.gradeLevel,
        term1: {
          preliminaryAssessment: grade?.preliminaryAssessment1 ?? null,
          score: grade?.term1Score ?? null,
          observations: grade?.rationale1 ?? null,
        },
        // En el RITE del 1° cuatrimestre, lo posterior todavía no se informa.
        term2: isFirstTerm
          ? null
          : {
              preliminaryAssessment: grade?.preliminaryAssessment2 ?? null,
              score: grade?.term2Score ?? null,
              observations: grade?.rationale2 ?? null,
            },
        intensification: isFirstTerm
          ? null
          : {
              december: intensificationScore(IntensificationPeriod.DECEMBER),
              february: intensificationScore(IntensificationPeriod.FEBRUARY_MARCH),
            },
        finalScore: isFirstTerm ? null : (grade?.finalScore ?? null),
      }
    })
    .sort(
      (a, b) => a.type.localeCompare(b.type) || a.subjectName.localeCompare(b.subjectName, 'es')
    )

  // Asistencia por cuatrimestre:
  // - días hábiles: los que cargó la dirección en el modal; si todavía no los cargó, los días con asistencia tomada;
  // - asistencias: días en que el alumno vino (presente o con retardo);
  // - inasistencias: faltas en peso (1, ½ y ¼), separadas en justificadas y sin justificar.
  const emptyTerm = () => ({
    schoolDays: 0,
    recordedDays: 0,
    attendances: 0,
    absences: 0,
    justifiedAbsences: 0,
    unjustifiedAbsences: 0,
  })
  const term1 = emptyTerm()
  const term2 = emptyTerm()
  for (const record of attendances) {
    const recordTerm = getTermOf(record.date, rite.academicYear)
    if (!recordTerm) continue
    const bucket = recordTerm === Term.FIRST ? term1 : term2
    bucket.recordedDays += 1
    if (record.value !== AttendanceValue.ABSENT) bucket.attendances += 1
    const weight = ABSENCE_WEIGHT[record.value]
    bucket.absences += weight
    if (record.justified) bucket.justifiedAbsences += weight
    else bucket.unjustifiedAbsences += weight
  }

  const configured = rite.academicYear
  term1.schoolDays = configured.term1SchoolDays ?? term1.recordedDays
  term2.schoolDays = configured.term2SchoolDays ?? term2.recordedDays

  // En el RITE del 1° cuatrimestre, los totales son solo de ese cuatrimestre
  const round = (value: number) => Math.round(value * 100) / 100
  const total = (key: keyof ReturnType<typeof emptyTerm>) =>
    round(term1[key] + (isFirstTerm ? 0 : term2[key]))

  return {
    institution: INSTITUTION,
    academicYear: rite.academicYear.year,
    term,
    isPostIntensification: rite.isPostIntensification,
    student: rite.student,
    section: enrollmentRecord?.classSection ?? null,
    subjects,
    attendance: {
      term1,
      term2: isFirstTerm ? null : term2,
      // Días hábiles del ciclo completo: el total cargado en el modal, o la suma de los cuatrimestres
      totalSchoolDays: isFirstTerm
        ? term1.schoolDays
        : (configured.totalSchoolDays ?? term1.schoolDays + term2.schoolDays),
      totalAttendances: total('attendances'),
      totalAbsences: total('absences'),
      totalJustifiedAbsences: total('justifiedAbsences'),
      totalUnjustifiedAbsences: total('unjustifiedAbsences'),
    },
    generalNotes: rite.generalNotes,
    notifications: yearRites.map((item) => ({
      term: item.term,
      isPostIntensification: item.isPostIntensification,
      status: item.status,
      signedAt: item.signedAt,
      signedBy: authorityName(item.signingAuthority),
    })),
  }
}

async function findRiteOrFail(id: string) {
  const rite = await prisma.rite.findUnique({ where: { id }, include: riteInclude })
  if (!rite) throw new HttpError(404, 'RITE no encontrado')
  return rite
}

// Cambia el estado solo si el RITE está en el estado esperado.
async function changeStatus(id: string, from: RiteStatus, to: RiteStatus, message: string) {
  const rite = await findRiteOrFail(id)
  if (rite.status !== from) throw new HttpError(409, message)

  await prisma.rite.update({ where: { id }, data: { status: to } })
  return getRite(id)
}

export async function listStudentRites(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } })
  if (!student) throw new HttpError(404, 'Estudiante no encontrado')

  const rites = await prisma.rite.findMany({
    where: { studentId },
    include: riteInclude,
    orderBy: [{ academicYear: { year: 'desc' } }, { term: 'asc' }, { isPostIntensification: 'asc' }],
  })

  return rites.map(toRiteSummary)
}

export async function createRite(input: CreateRiteInput) {
  const [student, academicYear] = await Promise.all([
    prisma.student.findUnique({ where: { id: input.studentId }, select: { id: true } }),
    prisma.academicYear.findUnique({ where: { year: input.year }, select: { id: true } }),
  ])
  if (!student) throw new HttpError(404, 'Estudiante no encontrado')
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')

  // El RITE post-intensificación se guarda como del 2° cuatrimestre.
  const term = input.isPostIntensification ? Term.SECOND : input.term

  // La intensificación viene después del cierre del año: el 2° cuatrimestre tiene que estar firmado.
  if (input.isPostIntensification) {
    const secondTermRite = await prisma.rite.findUnique({
      where: {
        studentId_academicYearId_term_isPostIntensification: {
          studentId: input.studentId,
          academicYearId: academicYear.id,
          term: Term.SECOND,
          isPostIntensification: false,
        },
      },
      select: { status: true },
    })
    if (secondTermRite?.status !== RiteStatus.SIGNED) {
      throw new HttpError(
        409,
        'Para generar el RITE post-intensificación, primero hay que firmar el del 2° cuatrimestre'
      )
    }
  }

  try {
    const rite = await prisma.rite.create({
      data: {
        studentId: input.studentId,
        academicYearId: academicYear.id,
        term,
        isPostIntensification: input.isPostIntensification,
      },
    })
    return getRite(rite.id)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'Ya existe ese RITE para el alumno en este ciclo lectivo')
    }
    throw err
  }
}

export async function getRite(id: string) {
  const rite = await findRiteOrFail(id)

  // Un RITE firmado se muestra siempre con la copia fija, aunque después cambien las notas.
  const document =
    rite.status === RiteStatus.SIGNED && rite.snapshot
      ? rite.snapshot
      : await buildRiteDocument(prisma, rite)

  return { rite: toRiteSummary(rite), document }
}

export async function updateRiteNotes(id: string, input: UpdateRiteNotesInput) {
  const rite = await findRiteOrFail(id)
  if (rite.status !== RiteStatus.DRAFT) {
    throw new HttpError(409, 'Solo se pueden modificar las observaciones de un RITE en borrador')
  }

  await prisma.rite.update({ where: { id }, data: { generalNotes: input.generalNotes } })
  return getRite(id)
}

export function closeRite(id: string) {
  return changeStatus(id, RiteStatus.DRAFT, RiteStatus.CLOSED, 'Solo se puede cerrar un RITE en borrador')
}

export function reopenRite(id: string) {
  return changeStatus(id, RiteStatus.CLOSED, RiteStatus.DRAFT, 'Solo se puede reabrir un RITE cerrado')
}

export async function signRite(id: string, userId: string) {
  const rite = await findRiteOrFail(id)
  if (rite.status !== RiteStatus.CLOSED) {
    throw new HttpError(409, 'Solo se puede firmar un RITE cerrado')
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.rite.update({
      where: { id },
      data: { status: RiteStatus.SIGNED, signedAt: new Date(), signingAuthorityId: userId },
    })

    // Se guarda la copia fija con los datos ya firmados, para que el documento no cambie.
    const signed = await tx.rite.findUniqueOrThrow({ where: { id }, include: riteInclude })
    const document = await buildRiteDocument(tx, signed)
    await tx.rite.update({
      where: { id },
      data: { snapshot: document as unknown as Prisma.InputJsonValue },
    })
  })

  return getRite(id)
}