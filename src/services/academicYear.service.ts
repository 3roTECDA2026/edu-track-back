import { prisma } from '@/lib/prisma'
import type { Prisma, PrismaClient } from '@prisma/client'

export function getAcademicYearFilter(year?: number) {
  return year !== undefined ? { year } : { isActive: true }
}

export async function listAcademicYearsService(client: PrismaClient = prisma) {
  const years = await client.academicCycle.findMany({
    orderBy: { year: 'desc' },
    select: {
      id: true,
      year: true,
      isActive: true,
      term1StartDate: true,
      term1EndDate: true,
      term2StartDate: true,
      term2EndDate: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return years.map(({ isActive, ...year }) => ({ ...year, active: isActive }))
}

export async function getCurrentAcademicYearService(client: PrismaClient = prisma) {
  const year = await client.academicCycle.findFirst({
    where: { isActive: true },
    orderBy: { year: 'desc' },
  })
  return year ? { ...year, active: year.isActive } : null
}

export async function createAcademicYearService(
  data: {
    year: number
    active?: boolean
    term1StartDate?: Date | string | null
    term1EndDate?: Date | string | null
    term2StartDate?: Date | string | null
    term2EndDate?: Date | string | null
    startDate?: Date | string | null
    endDate?: Date | string | null
  },
  client: PrismaClient | Prisma.TransactionClient = prisma
) {
  const { active, ...fields } = data
  const created = await client.academicCycle.create({
    data: {
      ...fields,
      isActive: active ?? false,
      term1StartDate: fields.term1StartDate ?? null,
      term1EndDate: fields.term1EndDate ?? null,
      term2StartDate: fields.term2StartDate ?? null,
      term2EndDate: fields.term2EndDate ?? null,
      startDate: fields.startDate ?? null,
      endDate: fields.endDate ?? null,
    },
  })
  return { ...created, active: created.isActive }
}

export async function setAcademicYearActiveService(
  id: string,
  client: PrismaClient | Prisma.TransactionClient = prisma
) {
  await client.academicCycle.updateMany({
    where: {
      isActive: true,
      id: { not: id },
    },
    data: { isActive: false },
  })

  const updated = await client.academicCycle.update({
    where: { id },
    data: { isActive: true },
  })
  return { ...updated, active: updated.isActive }
}

export async function updateAcademicYearService(
  id: string,
  data: Partial<{
    year: number
    active: boolean
    term1StartDate: Date | string | null
    term1EndDate: Date | string | null
    term2StartDate: Date | string | null
    term2EndDate: Date | string | null
    startDate: Date | string | null
    endDate: Date | string | null
  }>,
  client: PrismaClient = prisma
) {
  const { active, ...fields } = data
  const updated = await client.academicCycle.update({
    where: { id },
    data: { ...fields, ...(active !== undefined ? { isActive: active } : {}) },
  })
  return { ...updated, active: updated.isActive }
}
