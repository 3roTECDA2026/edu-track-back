import crypto from 'node:crypto'
import {
  CourseType,
  Prisma,
  type Shift,
  type StudentStatus,
  type Orientation,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { decideDestination, type DestinationDecisionResult } from '@/utils/matriculationDestination'
import { resolveTargetSubjects, type CurriculumPlanSummary } from '@/utils/resolveTargetSubjects'

export async function continueMatriculation(fromYearId: string, toYearId: string) {
  const [fromYear, toYear] = await Promise.all([
    prisma.academicYear.findUnique({
      where: { id: fromYearId },
      select: { id: true, year: true, closedAt: true },
    }),
    prisma.academicYear.findUnique({
      where: { id: toYearId },
      select: { id: true, year: true },
    }),
  ])

  if (!fromYear) {
    throw new HttpError(404, 'Ciclo lectivo de origen no encontrado')
  }
  if (!toYear) {
    throw new HttpError(404, 'Ciclo lectivo de destino no encontrado')
  }

  // Precondición 1: El ciclo de destino debe ser el inmediatamente posterior al de origen
  if (toYear.year !== fromYear.year + 1) {
    throw new HttpError(
      409,
      `El ciclo lectivo destino (${toYear.year}) debe ser el inmediatamente siguiente al ciclo de origen (${fromYear.year})`
    )
  }

  // Precondición 2: El ciclo de origen debe estar cerrado (CRM-052)
  if (!fromYear.closedAt) {
    throw new HttpError(
      409,
      'El ciclo lectivo de origen debe estar cerrado antes de ejecutar la matriculación continuada'
    )
  }

  // Precondición 3: Debe haberse ejecutado el motor de promoción en el ciclo origen (CRM-062)
  const promotionDecisionsCount = await prisma.promotionDecision.count({
    where: { academicYearId: fromYearId },
  })

  if (promotionDecisionsCount === 0) {
    throw new HttpError(
      409,
      'No se registran decisiones de promoción para el ciclo lectivo de origen. Debe ejecutar el motor de promoción antes de matricular'
    )
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Precargar secciones destino con sus materias curriculares asociadas
      const targetSections = await tx.classSection.findMany({
        where: { academicYearId: toYearId },
        select: {
          id: true,
          grade: true,
          division: true,
          shift: true,
          orientation: true,
          curriculumSubjects: {
            select: { subjectId: true },
          },
        },
      })

      // Mapeo auxiliar de materias por año escolar
      const subjectsByGrade = await tx.subject.findMany({
        select: { id: true, gradeLevel: true },
      })
      const gradeSubjectsMap = new Map<number, string[]>()
      for (const sub of subjectsByGrade) {
        const list = gradeSubjectsMap.get(sub.gradeLevel) ?? []
        list.push(sub.id)
        gradeSubjectsMap.set(sub.gradeLevel, list)
      }

      // Precargar planes de estudio (Curriculum) para asignación por orientación en Ciclo Superior
      const dbCurriculums = await tx.curriculum.findMany({
        select: {
          id: true,
          name: true,
          subjects: {
            select: {
              subjectId: true,
              gradeLevel: true,
            },
          },
        },
      })

      const curriculumsSummary: CurriculumPlanSummary[] = dbCurriculums.map((c) => {
        const subjectsByGrade = new Map<number, string[]>()
        const allSubjectIds = new Set<string>()
        for (const s of c.subjects) {
          const list = subjectsByGrade.get(s.gradeLevel) ?? []
          list.push(s.subjectId)
          subjectsByGrade.set(s.gradeLevel, list)
          allSubjectIds.add(s.subjectId)
        }
        return {
          id: c.id,
          name: c.name,
          subjectsByGrade,
          allSubjectIds,
        }
      })

      // 2. Precargar decisiones de promoción del ciclo origen
      const decisions = await tx.promotionDecision.findMany({
        where: { academicYearId: fromYearId },
        select: {
          studentId: true,
          outcome: true,
          pendingCount: true,
        },
      })
      const decisionsMap = new Map(decisions.map((d) => [d.studentId, d]))

      // 3. Determinar alumnos y sección activa de origen desde EnrollmentHistory (endDate: null)
      const sourceHistories = await tx.enrollmentHistory.findMany({
        where: {
          classSection: { academicYearId: fromYearId },
          endDate: null,
        },
        orderBy: { startDate: 'desc' },
        select: {
          studentId: true,
          classSection: {
            select: {
              id: true,
              grade: true,
              division: true,
              shift: true,
              orientation: true,
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      })

      const studentsMap = new Map<
        string,
        {
          student: { id: string; firstName: string; lastName: string; status: StudentStatus }
          section: {
            id: string
            grade: number
            division: string
            shift: Shift
            orientation: Orientation | null
          }
        }
      >()

      for (const h of sourceHistories) {
        if (!studentsMap.has(h.studentId)) {
          studentsMap.set(h.studentId, {
            student: h.student,
            section: h.classSection,
          })
        }
      }

      // 4. Precargar inscripciones de origen para deducir orientación de cada alumno
      // y precargar estudiantes ya matriculados en ciclo destino (Enrollment y EnrollmentHistory)
      const [sourceEnrollments, targetEnrollments, targetHistories] = await Promise.all([
        tx.enrollment.findMany({
          where: { academicYearId: fromYearId },
          select: { studentId: true, subjectId: true },
        }),
        tx.enrollment.findMany({
          where: { academicYearId: toYearId },
          select: { studentId: true, subjectId: true },
        }),
        tx.enrollmentHistory.findMany({
          where: {
            classSection: { academicYearId: toYearId },
            endDate: null,
          },
          select: { studentId: true },
        }),
      ])

      const sourceStudentSubjectsMap = new Map<string, string[]>()
      for (const e of sourceEnrollments) {
        const list = sourceStudentSubjectsMap.get(e.studentId) ?? []
        list.push(e.subjectId)
        sourceStudentSubjectsMap.set(e.studentId, list)
      }

      const enrolledStudentsInTarget = new Set<string>([
        ...targetEnrollments.map((e) => e.studentId),
        ...targetHistories.map((h) => h.studentId),
      ])
      const existingTargetKeys = new Set<string>(
        targetEnrollments.map((e) => `${e.studentId}|${e.subjectId}`)
      )

      // 5. Evaluar destino de cada alumno con la función pura decideDestination
      const details: DestinationDecisionResult[] = []
      const pendingPate: DestinationDecisionResult[] = []
      const pendingOrientation: DestinationDecisionResult[] = []
      const missingCurriculum: DestinationDecisionResult[] = []
      const graduates: DestinationDecisionResult[] = []

      const summary = {
        enrolled: 0,
        pendingPate: 0,
        pendingOrientation: 0,
        missingCurriculum: 0,
        graduates: 0,
        missingDecision: 0,
        missingSection: 0,
        alreadyEnrolled: 0,
        skippedStatus: 0,
      }

      const enrollmentsToCreate: Array<{
        id: string
        studentId: string
        subjectId: string
        classSectionId: string
        academicYearId: string
        courseType: CourseType
      }> = []

      const historyUpdates: string[] = []
      const historyToCreate: Array<{
        id: string
        studentId: string
        classSectionId: string
        startDate: Date
      }> = []

      const now = new Date()

      for (const [studentId, entry] of studentsMap.entries()) {
        const decision = decisionsMap.get(studentId)
        const res = decideDestination({
          student: entry.student,
          promotionDecision: decision,
          currentSection: entry.section,
          targetSections,
          alreadyEnrolledInTarget: enrolledStudentsInTarget.has(studentId),
        })

        details.push(res)
        summary[res.status]++

        if (res.status === 'pendingPate') {
          pendingPate.push(res)
        } else if (res.status === 'pendingOrientation') {
          pendingOrientation.push(res)
        } else if (res.status === 'graduates') {
          graduates.push(res)
        } else if (res.status === 'enrolled' && res.targetSectionId) {
          const targetSec = targetSections.find((s) => s.id === res.targetSectionId)
          if (!targetSec) continue

          const sourceSubjects = sourceStudentSubjectsMap.get(studentId) ?? []
          const sectionSubjects = targetSec.curriculumSubjects.map((cs) => cs.subjectId)
          const fallbackGrade = gradeSubjectsMap.get(targetSec.grade) ?? []

          // Resolver materias correspondientes respetando orientación del plan y límite de 12
          const subjectResolution = resolveTargetSubjects({
            targetGrade: targetSec.grade,
            sectionSubjectIds: sectionSubjects,
            fallbackGradeSubjects: fallbackGrade,
            studentSourceSubjectIds: sourceSubjects,
            curriculums: curriculumsSummary,
          })

          if (subjectResolution.missingCurriculum) {
            // No adivinar materias: se inscribe en la sección pero se lista aparte en missingCurriculum
            missingCurriculum.push({
              studentId,
              studentName: res.studentName,
              status: 'enrolled',
              targetSectionId: res.targetSectionId,
              targetSectionName: res.targetSectionName,
              reason:
                'Inscripto en la sección sin materias: requiere asignación manual de plan de estudios',
            })
            summary.missingCurriculum++
          }

          historyUpdates.push(studentId)
          historyToCreate.push({
            id: crypto.randomUUID(),
            studentId,
            classSectionId: res.targetSectionId,
            startDate: now,
          })

          for (const subjectId of subjectResolution.subjectIds) {
            const key = `${studentId}|${subjectId}`
            if (!existingTargetKeys.has(key)) {
              existingTargetKeys.add(key)
              enrollmentsToCreate.push({
                id: crypto.randomUUID(),
                studentId,
                subjectId,
                classSectionId: res.targetSectionId,
                academicYearId: toYearId,
                courseType: CourseType.FIRST_TIME,
              })
            }
          }
        }
      }

      // 6. Impactar en base de datos de manera atómica
      if (historyUpdates.length > 0) {
        await tx.enrollmentHistory.updateMany({
          where: {
            studentId: { in: historyUpdates },
            endDate: null,
          },
          data: {
            endDate: now,
            leaveReason: 'Promoción al ciclo lectivo siguiente (matriculación continuada)',
          },
        })

        await tx.enrollmentHistory.createMany({
          data: historyToCreate,
        })
      }

      if (enrollmentsToCreate.length > 0) {
        await tx.enrollment.createMany({
          data: enrollmentsToCreate,
        })
      }

      return {
        fromYear: fromYear.year,
        toYear: toYear.year,
        summary,
        createdEnrollments: enrollmentsToCreate.length,
        pendingPate,
        pendingOrientation,
        missingCurriculum,
        graduates,
        details,
      }
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(
        409,
        'Conflicto de concurrencia: inscripciones o matrícula duplicada durante la ejecución simultánea'
      )
    }
    throw err
  }
}
