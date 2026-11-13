import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Prisma } from '@prisma/client'

import { closeSourceEnrollmentHistories } from './matriculation.service'

type Db = Prisma.TransactionClient

interface HistoryRow {
  id: string
  studentId: string
  endDate: Date | null
  classSection: { academicYearId: string }
}

const fakeDb = (rows: HistoryRow[]) => {
  const calls: Array<{
    where: {
      studentId: { in: string[] }
      endDate: null
      classSection: { academicYearId: string }
    }
    data: { endDate: Date; leaveReason: string }
  }> = []

  const db = {
    enrollmentHistory: {
      updateMany: async (args: (typeof calls)[number]) => {
        calls.push(args)
        const yearId = args.where.classSection.academicYearId
        let count = 0

        for (const row of rows) {
          if (
            args.where.studentId.in.includes(row.studentId) &&
            row.endDate === null &&
            row.classSection.academicYearId === yearId
          ) {
            row.endDate = args.data.endDate
            count++
          }
        }

        return { count }
      },
    },
  } as unknown as Db

  return { db, calls, rows }
}

describe('cierre de historiales en la matriculación continuada (CRM-064)', () => {
  it('cierra solo los historiales activos del ciclo de origen y deja intactos los de otros ciclos', async () => {
    const endDate = new Date('2026-01-01T00:00:00Z')
    const rows: HistoryRow[] = [
      {
        id: 'source-1',
        studentId: 's1',
        endDate: null,
        classSection: { academicYearId: 'from-year' },
      },
      {
        id: 'other-year',
        studentId: 's1',
        endDate: null,
        classSection: { academicYearId: 'other-year' },
      },
      {
        id: 'source-2',
        studentId: 's2',
        endDate: null,
        classSection: { academicYearId: 'from-year' },
      },
    ]
    const { db, calls } = fakeDb(rows)

    await closeSourceEnrollmentHistories(db, ['s1', 's2'], 'from-year', endDate)

    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0]?.where, {
      studentId: { in: ['s1', 's2'] },
      endDate: null,
      classSection: { academicYearId: 'from-year' },
    })
    assert.deepEqual(calls[0]?.data, {
      endDate,
      leaveReason: 'Promoción al ciclo lectivo siguiente (matriculación continuada)',
    })
    assert.equal(rows.find((row) => row.id === 'source-1')?.endDate, endDate)
    assert.equal(rows.find((row) => row.id === 'source-2')?.endDate, endDate)
    assert.equal(rows.find((row) => row.id === 'other-year')?.endDate, null)
  })
})
