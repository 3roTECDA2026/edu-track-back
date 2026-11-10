import crypto from 'node:crypto'
import { CourseType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

export async function continueMatriculation(fromYearId: string, toYearId: string) {
  const [fromYear, toYear] = await Promise.all([
    prisma.academicYear.findUnique({ where: { id: fromYearId }, select: { id: true } }),
    prisma.academicYear.findUnique({ where: { id: toYearId }, select: { id: true } }),
  ])

  if (!fromYear) {
    throw new HttpError(404, 'Ciclo lectivo de origen no encontrado')
  }
  if (!toYear) {
    throw new HttpError(404, 'Ciclo lectivo de destino no encontrado')
  }

  return prisma.$transaction(async (tx) => {
    // Precargamos las secciones del ciclo origen y destino para evitar N+1 queries
    const [sourceSections, targetSections] = await Promise.all([
      tx.classSection.findMany({
        where: { academicYearId: fromYearId },
        select: { id: true, grade: true, division: true, shift: true, orientation: true },
      }),
      tx.classSection.findMany({
        where: { academicYearId: toYearId },
        select: { id: true, grade: true, division: true, shift: true, orientation: true },
      }),
    ])

    // Mapa de secciones del ciclo destino por criterios equivalentes
    const targetSectionMap = new Map<string, string>()
    for (const section of targetSections) {
      const key = `${section.grade}|${section.division}|${section.shift}|${section.orientation ?? ''}`
      targetSectionMap.set(key, section.id)
    }

    // Mapeo directo sourceSectionId -> targetSectionId equivalente
    const sourceToTargetSectionMap = new Map<string, string>()
    for (const section of sourceSections) {
      const key = `${section.grade}|${section.division}|${section.shift}|${section.orientation ?? ''}`
      const targetId = targetSectionMap.get(key)
      if (targetId) {
        sourceToTargetSectionMap.set(section.id, targetId)
      }
    }

    // Precargamos las inscripciones ya existentes en el ciclo destino
    const existingTargetEnrollments = await tx.enrollment.findMany({
      where: { academicYearId: toYearId },
      select: { studentId: true, subjectId: true },
    })

    const existingKeys = new Set<string>(
      existingTargetEnrollments.map((e) => `${e.studentId}|${e.subjectId}`)
    )

    // Obtenemos las inscripciones del ciclo origen
    const enrollments = await tx.enrollment.findMany({
      where: { academicYearId: fromYearId },
      select: { studentId: true, subjectId: true, classSectionId: true },
    })

    let skipped = 0
    const toCreate: Array<{
      id: string
      studentId: string
      subjectId: string
      classSectionId: string
      academicYearId: string
      courseType: CourseType
    }> = []

    for (const e of enrollments) {
      const key = `${e.studentId}|${e.subjectId}`
      if (existingKeys.has(key)) {
        skipped++
        continue
      }

      const targetSectionId = sourceToTargetSectionMap.get(e.classSectionId)
      if (!targetSectionId) {
        skipped++
        continue
      }

      existingKeys.add(key)
      toCreate.push({
        id: crypto.randomUUID(),
        studentId: e.studentId,
        subjectId: e.subjectId,
        classSectionId: targetSectionId,
        academicYearId: toYearId,
        courseType: CourseType.FIRST_TIME,
      })
    }

    if (toCreate.length > 0) {
      await tx.enrollment.createMany({
        data: toCreate,
      })
    }

    return { created: toCreate.length, skipped, total: enrollments.length }
  })
}
