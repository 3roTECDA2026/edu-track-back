import crypto from 'node:crypto'
import { CourseType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { decideDestination, type DestinationDecisionResult } from '@/utils/matriculationDestination'

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

  // Precondición 1: El ciclo de origen debe estar cerrado (CRM-052)
  if (!fromYear.closedAt) {
    throw new HttpError(
      409,
      'El ciclo lectivo de origen debe estar cerrado antes de ejecutar la matriculación continuada'
    )
  }

  // Precondición 2: Debe haberse ejecutado el motor de promoción en el ciclo origen (CRM-062)
  const promotionDecisionsCount = await prisma.promotionDecision.count({
    where: { academicYearId: fromYearId },
  })

  if (promotionDecisionsCount === 0) {
    throw new HttpError(
      409,
      'No se registran decisiones de promoción para el ciclo lectivo de origen. Debe ejecutar el motor de promoción antes de matricular'
    )
  }

  return prisma.$transaction(async (tx) => {
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

    // 3. Precargar inscripciones del ciclo origen para deducir sección previa del estudiante
    const sourceEnrollments = await tx.enrollment.findMany({
      where: { academicYearId: fromYearId },
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
        student: { id: string; firstName: string; lastName: string; status: any }
        section: {
          id: string
          grade: number
          division: string
          shift: string
          orientation: any
        }
      }
    >()

    for (const e of sourceEnrollments) {
      if (!studentsMap.has(e.studentId)) {
        studentsMap.set(e.studentId, {
          student: e.student,
          section: e.classSection,
        })
      }
    }

    // 4. Precargar inscripciones existentes en el ciclo destino
    const targetEnrollments = await tx.enrollment.findMany({
      where: { academicYearId: toYearId },
      select: { studentId: true, subjectId: true },
    })
    const enrolledStudentsInTarget = new Set<string>(targetEnrollments.map((e) => e.studentId))
    const existingTargetKeys = new Set<string>(
      targetEnrollments.map((e) => `${e.studentId}|${e.subjectId}`)
    )

    // 5. Evaluar destino de cada alumno con la función pura decideDestination
    const details: DestinationDecisionResult[] = []
    const summary = {
      enrolled: 0,
      pendingPate: 0,
      graduates: 0,
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

      if (res.status === 'enrolled' && res.targetSectionId) {
        historyUpdates.push(studentId)
        historyToCreate.push({
          id: crypto.randomUUID(),
          studentId,
          classSectionId: res.targetSectionId,
          startDate: now,
        })

        const targetSec = targetSections.find((s) => s.id === res.targetSectionId)
        let subjectIds: string[] = []
        if (targetSec && targetSec.curriculumSubjects.length > 0) {
          subjectIds = targetSec.curriculumSubjects.map((cs) => cs.subjectId)
        } else if (targetSec) {
          subjectIds = gradeSubjectsMap.get(targetSec.grade) ?? []
        }

        for (const subjectId of subjectIds) {
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
      details,
    }
  })
}
