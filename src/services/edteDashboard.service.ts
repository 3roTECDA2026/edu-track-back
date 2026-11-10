import {
  PendingSubjectStatus,
  PreliminaryAssessment,
  type Shift,
  StudentStatus,
  Term,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { EdteDashboardQuery } from '@/schemas/edteDashboard.schema'
import { HttpError } from '@/utils/httpError'
import { currentTerm } from '@/utils/schoolTerm'

// Dashboard del EDTE (E4-RF-05, CRM-077): indicadores de riesgo y alumnos con trayectorias
// complejas del ciclo activo. El tablero es un requerimiento propio del equipo; las reglas de
// MPAA salen de la normativa (A5, inc. 13: con 5 o más se deriva al EDTE).

const ENROLLED_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL]
const EARLY_WARNING_PENDING = 4 // Una MPAA más y se deriva
const REFERRED_PENDING = 5 // RN-012

// Peor valoración primero: TED (discontinua) > TEP (en proceso) > TEA (avanzada)
const ASSESSMENT_SEVERITY: PreliminaryAssessment[] = [
  PreliminaryAssessment.TED,
  PreliminaryAssessment.TEP,
  PreliminaryAssessment.TEA,
]

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'
const LEVEL_ORDER: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW']

type SectionInfo = { id: string; grade: number; division: string; shift: Shift }
type PateInfo = { id: string; status: string }

// Semáforo de cada alumno (propuesta del equipo; la normativa solo fija el 5 de las MPAA):
// rojo con 5 o más MPAA o 2 o más TED; ámbar con 4 MPAA, 1 TED o valoración TEP; verde el resto.
function riskLevel(
  pendingCount: number,
  tedCount: number,
  assessment: PreliminaryAssessment | null
) {
  if (pendingCount >= REFERRED_PENDING || tedCount >= 2) return 'HIGH'
  if (pendingCount === EARLY_WARNING_PENDING || tedCount === 1) return 'MEDIUM'
  if (assessment === PreliminaryAssessment.TEP) return 'MEDIUM'
  return 'LOW'
}

// Alumnos con PATE en curso en el ciclo.
// Provisorio hasta CRM-078: en develop el PATE todavía no tiene ciclo ni el estado IN_PROGRESS,
// así que devuelve vacío. Cuando esté, consulta status IN_PROGRESS y academicYearId.
async function getActivePates(_academicYearId: string): Promise<Map<string, PateInfo>> {
  return new Map()
}

export async function getEdteDashboard(query: EdteDashboardQuery) {
  const cycle = await prisma.academicYear.findFirst({
    where: { active: true },
    orderBy: { year: 'desc' },
    select: { id: true, year: true, term2StartDate: true },
  })
  if (!cycle) throw new HttpError(409, 'No hay un ciclo lectivo activo')
  const term = query.term ?? currentTerm(cycle)

  // Alumnos del ciclo: activos o condicionales con inscripción abierta a una sección
  const histories = await prisma.enrollmentHistory.findMany({
    where: {
      endDate: null,
      student: { status: { in: ENROLLED_STATUSES } },
      classSection: {
        academicYearId: cycle.id,
        ...(query.grade !== undefined && { grade: query.grade }),
        ...(query.classSectionId && { id: query.classSectionId }),
      },
    },
    orderBy: { startDate: 'desc' },
    select: {
      student: { select: { id: true, firstName: true, lastName: true, dni: true } },
      classSection: { select: { id: true, grade: true, division: true, shift: true } },
    },
  })
  const students = new Map<
    string,
    { student: (typeof histories)[number]['student']; section: SectionInfo }
  >()
  for (const history of histories) {
    if (!students.has(history.student.id)) {
      students.set(history.student.id, { student: history.student, section: history.classSection })
    }
  }
  const studentIds = [...students.keys()]

  const [enrollments, pendingGroups, pates] = await Promise.all([
    // Valoraciones del cuatrimestre de sus materias del ciclo
    prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, academicYearId: cycle.id },
      select: {
        studentId: true,
        grade: { select: { preliminaryAssessment1: true, preliminaryAssessment2: true } },
      },
    }),
    prisma.pendingSubject.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, status: PendingSubjectStatus.PENDING },
      _count: { _all: true },
    }),
    getActivePates(cycle.id),
  ])

  const assessmentsByStudent = new Map<string, PreliminaryAssessment[]>()
  for (const enrollment of enrollments) {
    const value =
      term === Term.FIRST
        ? enrollment.grade?.preliminaryAssessment1
        : enrollment.grade?.preliminaryAssessment2
    if (!value) continue
    const list = assessmentsByStudent.get(enrollment.studentId) ?? []
    list.push(value)
    assessmentsByStudent.set(enrollment.studentId, list)
  }
  const pendingByStudent = new Map(
    pendingGroups.map((group) => [group.studentId, group._count._all])
  )

  const rows = studentIds
    .map((id) => {
      const { student, section } = students.get(id)!
      const assessments = assessmentsByStudent.get(id) ?? []
      // La peor valoración de sus materias en el cuatrimestre (o null si no tiene ninguna)
      const assessment = ASSESSMENT_SEVERITY.find((value) => assessments.includes(value)) ?? null
      const tedCount = assessments.filter((value) => value === PreliminaryAssessment.TED).length
      const pendingSubjectsCount = pendingByStudent.get(id) ?? 0
      const pate = pates.get(id) ?? null
      return {
        id,
        firstName: student.firstName,
        lastName: student.lastName,
        dni: student.dni,
        section,
        assessment,
        tedCount,
        pendingSubjectsCount,
        level: riskLevel(pendingSubjectsCount, tedCount, assessment) as RiskLevel,
        pate,
        // Trayectoria compleja: 4 o más MPAA, alguna TED en el cuatrimestre o PATE en curso
        complex: pendingSubjectsCount >= EARLY_WARNING_PENDING || tedCount > 0 || pate !== null,
      }
    })
    // Filtro por valoración: se aplica a las tarjetas y al listado
    .filter((row) => !query.assessment || row.assessment === query.assessment)

  const count = (value: PreliminaryAssessment | null) =>
    rows.filter((row) => row.assessment === value).length

  return {
    academicYear: cycle.year,
    term,
    indicators: {
      totalStudents: rows.length,
      studentsByAssessment: {
        TEA: count(PreliminaryAssessment.TEA),
        TEP: count(PreliminaryAssessment.TEP),
        TED: count(PreliminaryAssessment.TED),
        NONE: count(null),
      },
      earlyWarning: rows.filter((row) => row.pendingSubjectsCount === EARLY_WARNING_PENDING).length,
      referred: rows.filter((row) => row.pendingSubjectsCount >= REFERRED_PENDING).length,
      // Es el único indicador que cuenta materias, no alumnos
      tedAssessments: rows.reduce((total, row) => total + row.tedCount, 0),
    },
    // Solo los alumnos con trayectorias complejas, de rojo a verde y por apellido
    students: rows
      .filter((row) => row.complex)
      .sort(
        (a, b) =>
          LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) ||
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es')
      )
      .map(({ complex: _complex, ...row }) => row),
  }
}
