import type { Prisma, PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type PrismaDbClient = PrismaClient | Prisma.TransactionClient

function toDate(value: Date | string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return value instanceof Date ? value : new Date(value)
}

export function getAcademicYearFilter(year?: number) {
  return year !== undefined
    ? { year }
    : { active: true }
}

export async function listAcademicYearsService(
  client: PrismaClient = prisma,
) {
  return client.academicYear.findMany({
    orderBy: { year: 'desc' },
    select: {
      id: true,
      year: true,
      active: true,
      term1StartDate: true,
      term1EndDate: true,
      term2StartDate: true,
      term2EndDate: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function getCurrentAcademicYearService(
  client: PrismaClient = prisma,
) {
  return client.academicYear.findFirst({
    where: { active: true },
    orderBy: { year: 'desc' },
  })
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
  client: PrismaDbClient = prisma,
) {
  const shouldActivate = data.active ?? false

  if (shouldActivate) {
    await client.academicYear.updateMany({
      where: { active: true },
      data: { active: false },
    })
  }

  return client.academicYear.create({
    data: {
      year: data.year,
      active: shouldActivate,

      // Compatibilidad con los nombres nuevos startDate/endDate.
      term1StartDate: toDate(
        data.term1StartDate ?? data.startDate,
      ) ?? null,

      term1EndDate: toDate(data.term1EndDate) ?? null,

      term2StartDate: toDate(data.term2StartDate) ?? null,

      term2EndDate: toDate(
        data.term2EndDate ?? data.endDate,
      ) ?? null,
    },
  })
}

export async function setAcademicYearActiveService(
  id: string,
  client: PrismaDbClient = prisma,
) {
  await client.academicYear.updateMany({
    where: {
      active: true,
      id: { not: id },
    },
    data: {
      active: false,
    },
  })

  return client.academicYear.update({
    where: { id },
    data: {
      active: true,
    },
  })
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
  client: PrismaClient = prisma,
) {
  const updateData: Prisma.AcademicYearUpdateInput = {}

  if (data.year !== undefined) {
    updateData.year = data.year
  }

  if (data.active !== undefined) {
    updateData.active = data.active
  }

  if (data.term1StartDate !== undefined || data.startDate !== undefined) {
    updateData.term1StartDate = toDate(
      data.term1StartDate ?? data.startDate,
    )
  }

  if (data.term1EndDate !== undefined) {
    updateData.term1EndDate = toDate(data.term1EndDate)
  }

  if (data.term2StartDate !== undefined) {
    updateData.term2StartDate = toDate(data.term2StartDate)
  }

  if (data.term2EndDate !== undefined || data.endDate !== undefined) {
    updateData.term2EndDate = toDate(
      data.term2EndDate ?? data.endDate,
    )
  }

  if (data.active === true) {
    await client.academicYear.updateMany({
      where: {
        active: true,
        id: { not: id },
      },
      data: {
        active: false,
      },
    })
  }

  return client.academicYear.update({
    where: { id },
    data: updateData,
  })
}