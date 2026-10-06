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
  isActive: boolean
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
}): AcademicCycle {
  return {
    id: record.id,
    year: record.year,
    isActive: record.isActive,
    startDate: record.startDate,
    endDate: record.endDate,
    createdAt: record.createdAt,
  }
}

export async function listCycles(): Promise<AcademicCycle[]> {
  const cycles = await prisma.academicCycle.findMany({
    orderBy: { year: 'desc' },
    select: { id: true, year: true, isActive: true, startDate: true, endDate: true, createdAt: true },
  })
  return cycles.map(toAcademicCycle)
}

export async function getActiveCycle(): Promise<AcademicCycle | null> {
  const cycle = await prisma.academicCycle.findFirst({
    where: { isActive: true },
    orderBy: { year: 'desc' },
    select: { id: true, year: true, isActive: true, startDate: true, endDate: true, createdAt: true },
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
    throw new HttpError(400, 'La fecha de cierre no puede ser anterior al inicio.')
  }

  const created = await prisma.academicCycle.create({
    data: {
      year: input.year,
      isActive: false,
      startDate: input.startDate,
      endDate: input.endDate,
    },
    select: { id: true, year: true, isActive: true, startDate: true, endDate: true, createdAt: true },
  })

  if (!input.isActive) return toAcademicCycle(created)
  return activateCycle(created.id)
}

export async function activateCycle(id: string): Promise<AcademicCycle> {
  return prisma.$transaction(
    async (transaction) => {
      const target = await transaction.academicCycle.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!target) throw new HttpError(404, 'No existe el ciclo lectivo solicitado.')

      await transaction.academicCycle.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      })

      const activated = await transaction.academicCycle.update({
        where: { id },
        data: { isActive: true },
        select: { id: true, year: true, isActive: true, startDate: true, endDate: true, createdAt: true },
      })
      return toAcademicCycle(activated)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
