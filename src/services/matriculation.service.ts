import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function continueMatriculation(fromYearId: string, toYearId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { academicYearId: fromYearId },
    select: { studentId: true, subjectId: true, classSectionId: true },
  })

  let created = 0
  let skipped = 0
  for (const e of enrollments) {
    const exists = await prisma.enrollment.findFirst({
      where: {
        studentId: e.studentId,
        subjectId: e.subjectId,
        academicYearId: toYearId,
      },
    })
    if (exists) {
      skipped++
      continue
    }

    const sourceSection = await prisma.classSection.findUnique({
      where: { id: e.classSectionId },
    })
    if (!sourceSection) {
      skipped++
      continue
    }
    const targetSection = await prisma.classSection.findFirst({
      where: {
        grade: sourceSection.grade,
        division: sourceSection.division,
        shift: sourceSection.shift,
        orientation: sourceSection.orientation,
        academicYearId: toYearId,
      },
    })
    if (!targetSection) {
      skipped++
      continue
    }

    await prisma.enrollment.create({
      data: {
        studentId: e.studentId,
        subjectId: e.subjectId,
        classSectionId: targetSection.id,
        academicYearId: toYearId,
        courseType: 'FIRST_TIME',
      },
    })
    created++
  }
  return { created, skipped, total: enrollments.length }
}
