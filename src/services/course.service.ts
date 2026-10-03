import { Orientation, Shift } from '@prisma/client'

import { prisma } from '@/lib/prisma' // O la instancia de Prisma que utilicen en tu proyecto

// --- SECCIÓN: CURSOS / DIVISIONES ---

export const getAllClassSectionsService = async () => {
  return await prisma.classSection.findMany({
    include: {
      academicYear: true,
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: [{ grade: 'asc' }, { division: 'asc' }],
  })
}

export const getClassSectionByIdService = async (id: string) => {
  return await prisma.classSection.findUnique({
    where: { id },
    include: {
      academicYear: true,
      enrollments: true,
      teacherAssignments: {
        include: { teacher: true, subject: true },
      },
    },
  })
}

export const createClassSectionService = async (data: {
  grade: number
  division: string
  shift: Shift
  orientation?: Orientation | null
  academicYearId: string
}) => {
  return await prisma.classSection.create({
    data,
  })
}

export const updateClassSectionService = async (
  id: string,
  data: Partial<{
    grade: number
    division: string
    shift: Shift
    orientation: Orientation | null
    academicYearId: string
  }>
) => {
  return await prisma.classSection.update({
    where: { id },
    data,
  })
}

export const deleteClassSectionService = async (id: string) => {
  return await prisma.classSection.delete({
    where: { id },
  })
}

// --- SECCIÓN: MATERIAS ---

export const getAllSubjectsService = async () => {
  return await prisma.subject.findMany({
    orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
  })
}

export const getSubjectByIdService = async (id: string) => {
  return await prisma.subject.findUnique({
    where: { id },
  })
}

export const createSubjectService = async (data: {
  name: string
  code: string
  hoursPerWeek: number
  gradeLevel: number
  area: string
}) => {
  return await prisma.subject.create({
    data,
  })
}

export const updateSubjectService = async (
  id: string,
  data: Partial<{
    name: string
    code: string
    hoursPerWeek: number
    gradeLevel: number
    area: string
  }>
) => {
  return await prisma.subject.update({
    where: { id },
    data,
  })
}

export const deleteSubjectService = async (id: string) => {
  return await prisma.subject.delete({
    where: { id },
  })
}
