import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

export interface AcademicCycle {
  id: string
  year: number
  isActive: boolean
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
}

function toAcademicCycle(record: {
  id: string
  year: number
  active: boolean
  term1StartDate: Date | null
  term2EndDate: Date | null
  createdAt: Date
}): AcademicCycle {
  return {
    id: record.id,
    year: record.year,
    isActive: record.active,
    startDate: record.term1StartDate,
    endDate: record.term2EndDate,
    createdAt: record.createdAt,
  }
}

export async function listCycles(): Promise<AcademicCycle[]> {
  const cycles = await prisma.academicYear.findMany({
    orderBy: { year: 'desc' },
    select: {
      id: true,
      year: true,
      active: true,
      term1StartDate: true,
      term2EndDate: true,
      createdAt: true,
    },
  })

  return cycles.map(toAcademicCycle)
}

export async function getActiveCycle(): Promise<AcademicCycle | null> {
  const cycle = await prisma.academicYear.findFirst({
    where: { active: true },
    orderBy: { year: 'desc' },
    select: {
      id: true,
      year: true,
      active: true,
      term1StartDate: true,
      term2EndDate: true,
      createdAt: true,
    },
  })

  return cycle ? toAcademicCycle(cycle) : null
}

export async function createCycle(input: {
  year: number
  isActive: boolean
  startDate?: Date
  endDate?: Date
}): Promise<AcademicCycle> {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new HttpError(
      400,
      'La fecha de cierre no puede ser anterior al inicio.',
    )
  }

  const created = await prisma.academicYear.create({
    data: {
      year: input.year,
      active: false,
      term1StartDate: input.startDate ?? null,
      term2EndDate: input.endDate ?? null,
    },
    select: {
      id: true,
      year: true,
      active: true,
      term1StartDate: true,
      term2EndDate: true,
      createdAt: true,
    },
  })

  if (!input.isActive) {
    return toAcademicCycle(created)
  }

  return activateCycle(created.id)
}

export async function activateCycle(id: string): Promise<AcademicCycle> {
  return prisma.$transaction(
    async (transaction) => {
      const target = await transaction.academicYear.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!target) {
        throw new HttpError(
          404,
          'No existe el ciclo lectivo solicitado.',
        )
      }

      await transaction.academicYear.updateMany({
        where: {
          active: true,
          id: { not: id },
        },
        data: {
          active: false,
        },
      })

      const activated = await transaction.academicYear.update({
        where: { id },
        data: {
          active: true,
        },
        select: {
          id: true,
          year: true,
          active: true,
          term1StartDate: true,
          term2EndDate: true,
          createdAt: true,
        },
      })

      return toAcademicCycle(activated)
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  )
}