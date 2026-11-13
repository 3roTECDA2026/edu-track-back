import { PendingSubjectStatus, Prisma, PromotionOutcome } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { ListEdteReferralsQuery } from '@/schemas/edteReferral.schema'
import { HttpError } from '@/utils/httpError'

// Listado de derivación al EDTE (E4-RF-02, regla RN-012, CRM-073).
// No calcula nada: lee las decisiones que guarda el motor de promoción (CRM-062) y muestra a los
// alumnos que quedaron derivados al EDTE, con sus materias pendientes (MPAA).

export async function listEdteReferrals(query: ListEdteReferralsQuery) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { year: query.year },
    select: { id: true },
  })
  if (!academicYear) throw new HttpError(404, 'Ciclo lectivo no encontrado')

  // Filtro por el curso en el que estaba el alumno en el ciclo que se cerró
  const hasSectionFilter =
    query.grade !== undefined || query.division !== undefined || query.shift !== undefined
  const sectionFilter: Prisma.ClassSectionWhereInput = {
    academicYearId: academicYear.id,
    ...(query.grade !== undefined && { grade: query.grade }),
    ...(query.division !== undefined && { division: query.division }),
    ...(query.shift !== undefined && { shift: query.shift }),
  }

  const decisions = await prisma.promotionDecision.findMany({
    where: {
      academicYearId: academicYear.id,
      outcome: PromotionOutcome.REFERRED_TO_EDTE,
      ...(hasSectionFilter && {
        student: { enrollmentHistory: { some: { classSection: sectionFilter } } },
      }),
    },
    select: {
      id: true,
      pendingCount: true,
      executedAt: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dni: true,
          // Su curso en el ciclo que se cerró (el último, si cambió de sección)
          enrollmentHistory: {
            where: { classSection: { academicYearId: academicYear.id } },
            orderBy: { startDate: 'desc' },
            take: 1,
            select: {
              classSection: { select: { id: true, grade: true, division: true, shift: true } },
            },
          },
          // Las materias que sigue debiendo hoy (las acreditadas después ya no aparecen)
          pendingSubjects: {
            // Las que sigue debiendo, de hasta el ciclo de la derivación (no las de ciclos posteriores)
            where: {
              status: PendingSubjectStatus.PENDING,
              originAcademicYear: { year: { lte: query.year } },
            },
            orderBy: { originAcademicYear: { year: 'asc' } },
            select: {
              id: true,
              subject: { select: { id: true, name: true, gradeLevel: true } },
              originAcademicYear: { select: { year: true } },
              originEnrollment: { select: { originalGradeLevel: true } },
            },
          },
        },
      },
    },
  })

  return decisions
    .map(({ student, ...decision }) => ({
      decisionId: decision.id,
      decidedAt: decision.executedAt,
      // Cuántas MPAA tenía al derivarse, y cuántas sigue debiendo hoy
      pendingCountAtDecision: decision.pendingCount,
      pendingCount: student.pendingSubjects.length,
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        dni: student.dni,
      },
      section: student.enrollmentHistory[0]?.classSection ?? null,
      pendingSubjects: student.pendingSubjects.map((pending) => ({
        pendingSubjectId: pending.id,
        subjectId: pending.subject.id,
        subjectName: pending.subject.name,
        gradeLevel: pending.originEnrollment.originalGradeLevel ?? pending.subject.gradeLevel,
        originYear: pending.originAcademicYear.year,
      })),
    }))
    .sort((a, b) =>
      `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`,
        'es'
      )
    )
}
