import { createHash } from 'node:crypto'

import {
  AuditActionType,
  EdteMeetingPeriod,
  EdteMeetingStatus,
  PateStatus,
  PendingSubjectStatus,
  Prisma,
  Role,
  type Shift,
  StudentStatus,
  UserStatus,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  CreateEdteMeetingInput,
  EdteMeetingCandidatesQuery,
  ListEdteMeetingsQuery,
  UpdateEdteMeetingInput,
} from '@/schemas/edteMeeting.schema'
import { getReferredStudentIds } from '@/services/promotionDecision.service'
import {
  buildEdteMinutesPdf,
  fromMinutesSnapshot,
  minutesContentHash,
  toMinutesSnapshot,
  type MinutesContent,
  type MinutesSnapshot,
} from '@/utils/edteMinutesPdf'
import { HttpError } from '@/utils/httpError'
import { toDate, toDay, todayInSchoolTimeZone } from '@/utils/schoolDate'

// Reuniones del EDTE (E4-RF-03, CRM-075): fecha, período, integrantes convocados, alumnos
// tratados y consideraciones. Se editan solo en borrador.

const personSelect = { select: { id: true, firstName: true, lastName: true } } as const
const studentSelect = {
  select: { id: true, firstName: true, lastName: true, dni: true },
} as const

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.lastName}, ${person.firstName}`

// Quién hace el cambio (del token) y desde qué IP, para la auditoría
interface Actor {
  userId: string
  ipAddress: string
}

// La base que usan las funciones: la de verdad, una transacción, o una falsa en los tests
type DbClient = Prisma.TransactionClient | typeof prisma

// Corre en una transacción. Si ya viene una (o una base falsa sin $transaction), la usa.
function inTransaction<T>(db: DbClient, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  return '$transaction' in db
    ? (db as typeof prisma).$transaction(run)
    : run(db as Prisma.TransactionClient)
}

// Personal que puede integrar el EDTE (Res. 1650/24, Anexo 2, inc. 22).
// Provisorio hasta que se fusione CRM-071: entonces los convocados salen del plantel activo
// (EdteTeamMember) y esta lista deja de usarse.
const EDTE_STAFF_ROLES: Role[] = [
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR,
  Role.ADMINISTRATOR,
]

const ENROLLED_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL]

const listNames = (people: { firstName: string; lastName: string }[]) =>
  people.map(fullName).join('; ')

const summaryInclude = {
  academicYear: { select: { id: true, year: true } },
  members: { select: { present: true } },
  _count: { select: { students: true } },
} satisfies Prisma.EdteMeetingInclude

type MeetingSummary = Prisma.EdteMeetingGetPayload<{ include: typeof summaryInclude }>

const detailInclude = {
  academicYear: { select: { id: true, year: true } },
  createdBy: personSelect,
  signedBy: personSelect,
  members: {
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  },
  students: {
    include: { student: studentSelect },
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  },
  // PATE armados en la reunión (CRM-078), para el acceso desde el detalle
  pates: { select: { id: true, studentId: true, status: true } },
} satisfies Prisma.EdteMeetingInclude

type MeetingDetail = Prisma.EdteMeetingGetPayload<{ include: typeof detailInclude }>

function toMeetingSummary(meeting: MeetingSummary) {
  return {
    id: meeting.id,
    year: meeting.academicYear.year,
    date: toDay(meeting.date),
    period: meeting.period,
    shift: meeting.shift,
    status: meeting.status,
    minutesUrl: meeting.minutesUrl,
    membersCount: meeting.members.length,
    presentCount: meeting.members.filter((member) => member.present).length,
    studentsCount: meeting._count.students,
    signedAt: meeting.signedAt,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  }
}

type SectionInfo = { id: string; grade: number; division: string; shift: Shift }

// Sección actual de cada alumno en el ciclo (inscripción abierta a una división)
async function currentSectionsByStudent(
  studentIds: string[],
  academicYearId: string,
  db: DbClient = prisma
): Promise<Map<string, SectionInfo>> {
  if (studentIds.length === 0) return new Map()
  const records = await db.enrollmentHistory.findMany({
    where: { studentId: { in: studentIds }, endDate: null, classSection: { academicYearId } },
    select: {
      studentId: true,
      classSection: { select: { id: true, grade: true, division: true, shift: true } },
    },
  })
  return new Map(records.map((record) => [record.studentId, record.classSection]))
}

// Cantidad de MPAA pendientes de cada alumno
async function pendingCountByStudent(studentIds: string[], db: DbClient = prisma) {
  if (studentIds.length === 0) return new Map<string, number>()
  const groups = await db.pendingSubject.groupBy({
    by: ['studentId'],
    where: { studentId: { in: studentIds }, status: PendingSubjectStatus.PENDING },
    _count: { _all: true },
  })
  return new Map(groups.map((group) => [group.studentId, group._count._all]))
}

async function toMeetingDetail(meeting: MeetingDetail, db: DbClient = prisma) {
  const studentIds = meeting.students.map((item) => item.studentId)
  const [sections, pendingCounts] = await Promise.all([
    currentSectionsByStudent(studentIds, meeting.academicYearId, db),
    pendingCountByStudent(studentIds, db),
  ])

  return {
    ...toMeetingSummary({
      ...meeting,
      _count: { students: meeting.students.length },
    }),
    considerations: meeting.considerations,
    createdBy: meeting.createdBy
      ? { id: meeting.createdBy.id, name: fullName(meeting.createdBy) }
      : null,
    signedBy: meeting.signedBy
      ? { id: meeting.signedBy.id, name: fullName(meeting.signedBy) }
      : null,
    members: meeting.members.map((member) => ({
      userId: member.userId,
      name: fullName(member.user),
      role: member.user.role,
      // Rol con el que participó, guardado al cargar la reunión (no cambia si cambia el usuario)
      roleInMeeting: member.roleInMeeting,
      present: member.present,
      // Cuándo firmó el acta (CRM-076); null si todavía no firmó
      signedAt: member.signedAt,
    })),
    students: meeting.students.map((item) => {
      const pate = meeting.pates.find((plan) => plan.studentId === item.studentId)
      return {
        studentId: item.studentId,
        firstName: item.student.firstName,
        lastName: item.student.lastName,
        dni: item.student.dni,
        section: sections.get(item.studentId) ?? null,
        pendingSubjectsCount: pendingCounts.get(item.studentId) ?? 0,
        notes: item.notes,
        pate: pate ? { id: pate.id, status: pate.status } : null,
      }
    }),
  }
}

async function findMeetingOrFail(id: string, db: DbClient = prisma) {
  const meeting = await db.edteMeeting.findUnique({ where: { id }, include: detailInclude })
  if (!meeting) throw new HttpError(404, 'Reunión del EDTE no encontrada')
  return meeting
}

// Listado, de la más reciente a la más vieja
export async function listEdteMeetings(query: ListEdteMeetingsQuery) {
  const meetings = await prisma.edteMeeting.findMany({
    where: {
      ...(query.year !== undefined && { academicYear: { year: query.year } }),
      ...(query.period && { period: query.period }),
      ...(query.status && { status: query.status }),
    },
    include: summaryInclude,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })
  return meetings.map(toMeetingSummary)
}

// Detalle: integrantes convocados, alumnos tratados y el PATE de cada uno (si lo tiene)
export async function getEdteMeeting(id: string, db: DbClient = prisma) {
  return toMeetingDetail(await findMeetingOrFail(id, db), db)
}

// La fecha tiene que ser del año del ciclo; la reunión de febrero/marzo, de esos meses
function assertMeetingDate(date: string, period: EdteMeetingPeriod, year: number) {
  const day = toDate(date)
  if (day.getUTCFullYear() !== year) {
    throw new HttpError(409, `La fecha de la reunión tiene que ser del año ${year}`)
  }
  const month = day.getUTCMonth() // 0 = enero
  if (period === EdteMeetingPeriod.FEBRUARY_MARCH && month !== 1 && month !== 2) {
    throw new HttpError(409, 'La reunión de febrero/marzo tiene que ser en febrero o marzo')
  }
}

// Convocados: usuarios activos del personal. Devuelve el rol de cada uno, que se guarda como
// el rol con el que participó. Provisorio hasta CRM-071 (ver EDTE_STAFF_ROLES).
async function getEligibleMembers(db: Prisma.TransactionClient, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, Role>()
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, role: true, status: true },
  })
  if (users.length !== userIds.length) {
    throw new HttpError(404, 'Algún integrante no existe')
  }
  const invalid = users.filter(
    (user) => user.status !== UserStatus.ACTIVE || !EDTE_STAFF_ROLES.includes(user.role)
  )
  if (invalid.length > 0) {
    throw new HttpError(
      409,
      `No pueden integrar el EDTE (usuario inactivo o sin rol de personal): ${listNames(invalid)}`
    )
  }
  return new Map(users.map((user) => [user.id, user.role]))
}

// Alumnos tratados: tienen que existir y estar activos o condicionales
async function assertEligibleStudents(db: Prisma.TransactionClient, studentIds: string[]) {
  if (studentIds.length === 0) return
  const students = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, status: true },
  })
  if (students.length !== studentIds.length) {
    throw new HttpError(404, 'Algún alumno no existe')
  }
  const inactive = students.filter((student) => !ENROLLED_STATUSES.includes(student.status))
  if (inactive.length > 0) {
    throw new HttpError(409, `Estos alumnos no están activos: ${listNames(inactive)}`)
  }
}

// Resumen de la reunión para la auditoría (sin las consideraciones, que pueden ser sensibles)
const auditSnapshot = (data: {
  date: string
  period: EdteMeetingPeriod
  shift?: Shift | null
  members?: { userId: string; present: boolean }[]
  students?: { studentId: string }[]
}) => ({
  date: data.date,
  period: data.period,
  shift: data.shift ?? null,
  ...(data.members && {
    members: data.members.length,
    present: data.members.filter((member) => member.present).length,
  }),
  ...(data.students && { students: data.students.map((student) => student.studentId) }),
})

// Alta en borrador, con sus convocados y alumnos tratados
export async function createEdteMeeting(input: CreateEdteMeetingInput, actor: Actor) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { year: input.year },
    select: { id: true },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')
  assertMeetingDate(input.date, input.period, input.year)

  const id = await prisma.$transaction(async (tx) => {
    const roles = await getEligibleMembers(
      tx,
      input.members.map((member) => member.userId)
    )
    await assertEligibleStudents(
      tx,
      input.students.map((student) => student.studentId)
    )

    const meeting = await tx.edteMeeting.create({
      data: {
        academicYearId: academicYear.id,
        date: toDate(input.date),
        period: input.period,
        shift: input.shift ?? null,
        considerations: input.considerations || null,
        minutesUrl: input.minutesUrl || null,
        createdById: actor.userId,
        members: {
          create: input.members.map((member) => ({
            userId: member.userId,
            present: member.present,
            roleInMeeting: roles.get(member.userId) ?? null,
          })),
        },
        students: {
          create: input.students.map((student) => ({
            studentId: student.studentId,
            notes: student.notes || null,
          })),
        },
      },
      select: { id: true },
    })

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.CREATE,
        affectedEntity: 'EdteMeeting',
        entityId: meeting.id,
        newData: auditSnapshot(input),
        ipAddress: actor.ipAddress,
      },
    })
    return meeting.id
  })

  return getEdteMeeting(id)
}

// Traba la reunión hasta que termine la transacción y confirma que siga en borrador. La usan la
// edición, la firma y el seguimiento del PATE: así nunca se cambia el acta mientras se firma, ni
// después (CRM-076)
export async function lockDraftMeeting(tx: Prisma.TransactionClient, id: string, message: string) {
  await tx.$queryRaw`SELECT id FROM "EdteMeeting" WHERE id = ${id} FOR UPDATE`
  const meeting = await tx.edteMeeting.findUnique({ where: { id }, select: { status: true } })
  if (!meeting) throw new HttpError(404, 'Reunión del EDTE no encontrada')
  if (meeting.status !== EdteMeetingStatus.DRAFT) throw new HttpError(409, message)
}

// Edición: solo en borrador. Las listas que vienen reemplazan a las anteriores
export async function updateEdteMeeting(
  id: string,
  input: UpdateEdteMeetingInput,
  actor: Actor,
  db: DbClient = prisma
) {
  const meeting = await findMeetingOrFail(id, db)
  if (meeting.status !== EdteMeetingStatus.DRAFT) {
    throw new HttpError(409, 'La reunión ya está firmada: no se puede modificar')
  }

  const date = input.date ?? toDay(meeting.date)
  const period = input.period ?? meeting.period
  assertMeetingDate(date, period, meeting.academicYear.year)

  await inTransaction(db, async (tx) => {
    await lockDraftMeeting(tx, id, 'La reunión ya está firmada: no se puede modificar')

    const roles = input.members
      ? await getEligibleMembers(
          tx,
          input.members.map((member) => member.userId)
        )
      : null
    if (input.students) {
      await assertEligibleStudents(
        tx,
        input.students.map((student) => student.studentId)
      )
    }

    await tx.edteMeeting.update({
      where: { id },
      data: {
        ...(input.date !== undefined && { date: toDate(input.date) }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.shift !== undefined && { shift: input.shift }),
        ...(input.considerations !== undefined && {
          considerations: input.considerations || null,
        }),
        ...(input.minutesUrl !== undefined && { minutesUrl: input.minutesUrl || null }),
      },
    })

    // Si el borrador cambia, las firmas que ya había dejan de valer: el acta se vuelve a firmar
    // con los datos nuevos (CRM-076)
    await tx.edteMember.updateMany({
      where: { edteMeetingId: id, signedAt: { not: null } },
      data: { signedAt: null, signatureHash: null },
    })

    if (input.members && roles) {
      await tx.edteMember.deleteMany({ where: { edteMeetingId: id } })
      await tx.edteMember.createMany({
        data: input.members.map((member) => ({
          edteMeetingId: id,
          userId: member.userId,
          present: member.present,
          roleInMeeting: roles.get(member.userId) ?? null,
        })),
      })
    }
    if (input.students) {
      await tx.edteMeetingStudent.deleteMany({ where: { edteMeetingId: id } })
      await tx.edteMeetingStudent.createMany({
        data: input.students.map((student) => ({
          edteMeetingId: id,
          studentId: student.studentId,
          notes: student.notes || null,
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.UPDATE,
        affectedEntity: 'EdteMeeting',
        entityId: id,
        previousData: auditSnapshot({
          date: toDay(meeting.date),
          period: meeting.period,
          shift: meeting.shift,
          members: meeting.members,
          students: meeting.students,
        }),
        newData: auditSnapshot({
          date,
          period,
          shift: input.shift !== undefined ? input.shift : meeting.shift,
          members: input.members,
          students: input.students,
        }),
        ipAddress: actor.ipAddress,
      },
    })
  })

  return getEdteMeeting(id, db)
}

// Alumnos con PATE en curso en el ciclo, para las reuniones de seguimiento (agosto y diciembre).
// El PATE tiene su propio ciclo y se confirma pasando a IN_PROGRESS (CRM-078).
async function getStudentsWithActivePate(academicYearId: string) {
  const pates = await prisma.pate.findMany({
    where: {
      status: PateStatus.IN_PROGRESS,
      academicYearId,
      student: { status: { in: ENROLLED_STATUSES } },
    },
    select: { id: true, studentId: true, status: true },
  })
  return new Map(pates.map((pate) => [pate.studentId, { id: pate.id, status: pate.status }]))
}

// Alumnos para tratar en una reunión, según su período (DA7, 2.3):
// - febrero/marzo: los derivados al cierre del ciclo anterior, para armar su PATE;
// - agosto y diciembre: los que tienen PATE en curso, para el seguimiento;
// - adicional: los dos grupos.
// El selector del front ofrece estos alumnos; el alta acepta cualquier alumno activo.
export async function getEdteMeetingCandidates(query: EdteMeetingCandidatesQuery) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { year: query.year },
    select: { id: true },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')

  const wantsReferred =
    query.period === EdteMeetingPeriod.FEBRUARY_MARCH ||
    query.period === EdteMeetingPeriod.ADDITIONAL
  const wantsFollowUp = query.period !== EdteMeetingPeriod.FEBRUARY_MARCH

  const [referredIds, activePates] = await Promise.all([
    wantsReferred ? getReferredStudentIds(query.year - 1) : Promise.resolve([]),
    wantsFollowUp
      ? getStudentsWithActivePate(academicYear.id)
      : Promise.resolve(new Map<string, { id: string; status: PateStatus }>()),
  ])

  const referred = new Set(referredIds)
  const studentIds = [...new Set([...referredIds, ...activePates.keys()])]
  if (studentIds.length === 0) return []

  const [students, sections, pendingCounts] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, dni: true },
    }),
    currentSectionsByStudent(studentIds, academicYear.id),
    pendingCountByStudent(studentIds),
  ])

  return students
    .map((student) => ({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      dni: student.dni,
      section: sections.get(student.id) ?? null,
      pendingSubjectsCount: pendingCounts.get(student.id) ?? 0,
      // Por qué aparece: derivado al EDTE o seguimiento de su PATE
      referred: referred.has(student.id),
      pate: activePates.get(student.id) ?? null,
    }))
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es')
    )
}

// Ruta del acta en PDF: se genera al descargarla (CRM-076)
const minutesPath = (id: string) => `/api/edte-meetings/${id}/minutes`

// Huella de la firma: quién firmó, cuándo y qué contenido del acta firmó (E4-RF-04), hasta que se
// defina si se usa firma digital con PKI
const signatureFingerprint = (
  meetingId: string,
  userId: string,
  signedAt: Date,
  contentHash: string
) =>
  createHash('sha256')
    .update(`${meetingId}:${userId}:${signedAt.toISOString()}:${contentHash}`)
    .digest('hex')

// Encabezado del acta con los datos de la institución (los mismos del RITE, CRM-042)
function institutionLine(
  config: {
    institutionName: string | null
    institutionNumber: string | null
    district: string | null
  } | null
) {
  return [
    config?.institutionName ?? 'Institución sin configurar',
    config?.institutionNumber && `Nº ${config.institutionNumber}`,
    config?.district && `Distrito ${config.district}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

// Contenido del acta con los datos de ahora: el del borrador, el que firma cada integrante y el
// que se guarda como copia fija al completarse las firmas (CRM-076)
async function buildMinutesContent(meeting: MeetingDetail, db: DbClient): Promise<MinutesContent> {
  // De a una consulta (sin Promise.all): también se usa dentro de la transacción de la firma
  const config = await db.institutionalConfig.findUnique({
    where: { singleton: true },
    select: { institutionName: true, institutionNumber: true, district: true },
  })
  const sections = await currentSectionsByStudent(
    meeting.students.map((item) => item.studentId),
    meeting.academicYearId,
    db
  )

  return {
    institution: institutionLine(config),
    year: meeting.academicYear.year,
    date: toDay(meeting.date),
    period: meeting.period,
    shift: meeting.shift,
    considerations: meeting.considerations,
    signed: meeting.status === EdteMeetingStatus.SIGNED,
    signedAt: meeting.signedAt,
    members: meeting.members.map((member) => ({
      userId: member.userId,
      name: fullName(member.user),
      role: member.roleInMeeting,
      present: member.present,
      signedAt: member.signedAt,
      signatureHash: member.signatureHash,
    })),
    students: meeting.students.map((item) => {
      const section = sections.get(item.studentId)
      return {
        studentId: item.studentId,
        name: fullName(item.student),
        dni: item.student.dni,
        section: section ? `${section.grade}° ${section.division}` : null,
        notes: item.notes,
      }
    }),
  }
}

// Firma del acta de un integrante presente (E4-RF-04, CRM-076). Cuando firma el último
// presente, la reunión queda firmada, se guarda la copia fija del acta y ya no se puede editar.
export async function signEdteMeeting(id: string, actor: Actor, db: DbClient = prisma) {
  const meeting = await findMeetingOrFail(id, db)
  if (meeting.status !== EdteMeetingStatus.DRAFT) {
    throw new HttpError(409, 'La reunión ya está firmada')
  }
  if (toDay(meeting.date) > todayInSchoolTimeZone()) {
    throw new HttpError(409, 'La reunión todavía no ocurrió: no se puede firmar el acta')
  }
  // Sin presentes no hay quién firme: el acta no se podría cerrar nunca
  if (!meeting.members.some((item) => item.present)) {
    throw new HttpError(
      409,
      'La reunión no tiene integrantes presentes: no hay quién firme el acta'
    )
  }
  const member = meeting.members.find((item) => item.userId === actor.userId)
  if (!member?.present) {
    throw new HttpError(403, 'Solo los integrantes presentes en la reunión pueden firmar el acta')
  }
  if (member.signedAt) {
    throw new HttpError(409, 'Ya firmaste el acta de esta reunión')
  }

  await inTransaction(db, async (tx) => {
    await lockDraftMeeting(tx, id, 'La reunión ya está firmada')

    // Con la reunión trabada, el contenido no cambia hasta terminar: es justo lo que se firma
    const signedAt = new Date()
    const contentHash = minutesContentHash(
      await buildMinutesContent(await findMeetingOrFail(id, tx), tx)
    )

    // Solo si sigue presente y sin firmar (por si la lista cambió o firmó dos veces a la vez)
    const { count } = await tx.edteMember.updateMany({
      where: { edteMeetingId: id, userId: actor.userId, present: true, signedAt: null },
      data: {
        signedAt,
        signatureHash: signatureFingerprint(id, actor.userId, signedAt, contentHash),
      },
    })
    if (count === 0) {
      throw new HttpError(409, 'No se pudo firmar: ya firmaste o cambió la lista de presentes')
    }

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.SIGN,
        affectedEntity: 'EdteMeeting',
        entityId: id,
        newData: { signedBy: actor.userId, signedAt: signedAt.toISOString(), contentHash },
        ipAddress: actor.ipAddress,
      },
    })

    // Si ya firmaron todos los presentes, el acta queda firmada y la reunión no se edita más.
    // signedBy queda como quien completó las firmas.
    const pending = await tx.edteMember.count({
      where: { edteMeetingId: id, present: true, signedAt: null },
    })
    if (pending > 0) return

    // Copia fija del acta con todas las firmas (como el RITE): el acta firmada sale siempre de
    // acá, aunque después cambien los nombres, las secciones o los datos de la institución
    const signedMeeting = await findMeetingOrFail(id, tx)
    const snapshot = toMinutesSnapshot({
      ...(await buildMinutesContent(signedMeeting, tx)),
      signed: true,
      signedAt,
    })

    await tx.edteMeeting.update({
      where: { id },
      data: {
        status: EdteMeetingStatus.SIGNED,
        signedAt,
        signedById: actor.userId,
        minutesUrl: minutesPath(id),
        minutesSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: AuditActionType.SIGN,
        affectedEntity: 'EdteMeeting',
        entityId: id,
        newData: {
          status: EdteMeetingStatus.SIGNED,
          signedAt: signedAt.toISOString(),
          minutesUrl: minutesPath(id),
          contentHash,
        },
        ipAddress: actor.ipAddress,
      },
    })
  })

  return getEdteMeeting(id, db)
}

// El acta tiene datos sensibles de alumnos: la bajan quienes gestionan las reuniones y los
// integrantes convocados a esa reunión, presentes o ausentes (figuran en el acta)
const MINUTES_MANAGER_ROLES: Role[] = [
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
]

// Acta de la reunión en PDF (CRM-076). Firmada, sale de la copia fija; en borrador, con los datos
// de ahora y marcada como tal, así los integrantes pueden leerla antes de firmar. Las reuniones
// firmadas antes de la CRM-076 no tienen copia: salen con los datos de ahora.
export async function getEdteMeetingMinutes(
  id: string,
  viewer: Actor & { role: Role },
  db: DbClient = prisma
) {
  const meeting = await findMeetingOrFail(id, db)
  const convened = meeting.members.some((member) => member.userId === viewer.userId)
  if (!convened && !MINUTES_MANAGER_ROLES.includes(viewer.role)) {
    throw new HttpError(
      403,
      'El acta la pueden ver los integrantes convocados a la reunión y quienes gestionan las reuniones'
    )
  }

  const content =
    meeting.status === EdteMeetingStatus.SIGNED && meeting.minutesSnapshot
      ? fromMinutesSnapshot(meeting.minutesSnapshot as unknown as MinutesSnapshot)
      : await buildMinutesContent(meeting, db)
  const file = await buildEdteMinutesPdf(content, new Date())

  // E4-RNF-03: el acta tiene nombres y DNI de alumnos. Se registra quién la descargó, sin guardar
  // su contenido.
  await db.auditLog.create({
    data: {
      userId: viewer.userId,
      action: AuditActionType.SENSITIVE_VIEW,
      affectedEntity: 'EdteMeeting',
      entityId: id,
      newData: { operation: 'DOWNLOAD_MINUTES', status: meeting.status },
      ipAddress: viewer.ipAddress,
    },
  })

  return { fileName: `acta-edte-${toDay(meeting.date)}.pdf`, content: file }
}

// Personal que se puede convocar a una reunión, para el checklist del formulario.
// Provisorio hasta CRM-071: entonces devuelve los integrantes activos del plantel del EDTE.
export async function getEdteMeetingMemberOptions() {
  const users = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVE, role: { in: EDTE_STAFF_ROLES } },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return users.map((user) => ({ userId: user.id, name: fullName(user), role: user.role }))
}
