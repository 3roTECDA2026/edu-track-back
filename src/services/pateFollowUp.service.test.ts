import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PateEvaluation, PateStatus } from '@prisma/client'

import { HttpError } from '@/utils/httpError'

import { createPateFollowUp } from './pate.service'

const actor = { userId: 'u1', ipAddress: '127.0.0.1' }

const basePate = (status: PateStatus = PateStatus.IN_PROGRESS) => ({
  id: 'pate-1',
  studentId: 's1',
  academicYearId: 'y2026',
  status,
  year: 2026,
  subjectsToIntensify: [],
  subjectsToRepeat: [],
})

function fakeDb(options: {
  pateStatus?: PateStatus
  meetingYearId?: string
  meetingStatus?: 'DRAFT' | 'SIGNED'
  studentTreated?: boolean
}) {
  const {
    pateStatus = PateStatus.IN_PROGRESS,
    meetingYearId = 'y2026',
    meetingStatus = 'SIGNED',
    studentTreated = true,
  } = options

  const calls = {
    edteStudentsCreated: [] as unknown[],
    followUpsCreated: [] as unknown[],
    auditsCreated: [] as unknown[],
  }

  const tx = {
    pate: {
      findUnique: async () => basePate(pateStatus),
    },
    edteMeeting: {
      findUnique: async () => ({
        id: 'meet-1',
        academicYearId: meetingYearId,
        status: meetingStatus,
      }),
    },
    edteMeetingStudent: {
      findUnique: async () => (studentTreated ? { id: 'ems-1' } : null),
      create: async (args: unknown) => {
        calls.edteStudentsCreated.push(args)
        return { id: 'ems-created' }
      },
      upsert: async (args: unknown) => {
        calls.edteStudentsCreated.push(args)
        return { id: 'ems-created' }
      },
    },
    pateFollowUp: {
      create: async (args: any) => {
        calls.followUpsCreated.push(args)
        return {
          id: 'fu-1',
          pateId: args.data.pateId,
          edteMeetingId: args.data.edteMeetingId,
          date: args.data.date,
          progress: args.data.progress,
          evaluation: args.data.evaluation,
          observations: args.data.observations,
          createdAt: new Date(),
          edteMeeting: {
            id: 'meet-1',
            date: new Date('2026-05-10T12:00:00Z'),
            period: 'AUGUST',
          },
          createdBy: {
            id: 'u1',
            firstName: 'Fernanda',
            lastName: 'Rodríguez',
          },
        }
      },
    },
    auditLog: {
      create: async (args: unknown) => calls.auditsCreated.push(args),
    },
  }

  const db = {
    ...tx,
    $transaction: async (cb: (client: typeof tx) => Promise<any>) => cb(tx),
  }

  return { db, calls }
}

describe('createPateFollowUp', () => {
  it('rechaza si el PATE todavía está en borrador (409)', async () => {
    const { db } = fakeDb({ pateStatus: PateStatus.DRAFT })
    await assert.rejects(
      createPateFollowUp(
        'pate-1',
        {
          edteMeetingId: 'meet-1',
          progress: 'Avance',
          evaluation: PateEvaluation.FAVORABLE,
        },
        actor,
        db as any
      ),
      (err: unknown) => {
        assert(err instanceof HttpError)
        assert.equal(err.status, 409)
        assert.match(err.message, /borrador/)
        return true
      }
    )
  })

  it('rechaza si el PATE ya está cerrado (409)', async () => {
    const { db } = fakeDb({ pateStatus: PateStatus.CLOSED })
    await assert.rejects(
      createPateFollowUp(
        'pate-1',
        {
          edteMeetingId: 'meet-1',
          progress: 'Avance',
          evaluation: PateEvaluation.FAVORABLE,
        },
        actor,
        db as any
      ),
      (err: unknown) => {
        assert(err instanceof HttpError)
        assert.equal(err.status, 409)
        assert.match(err.message, /cerrado/)
        return true
      }
    )
  })

  it('rechaza si la reunión pertenece a otro ciclo lectivo (409)', async () => {
    const { db } = fakeDb({ meetingYearId: 'y2025' })
    await assert.rejects(
      createPateFollowUp(
        'pate-1',
        {
          edteMeetingId: 'meet-1',
          progress: 'Avance',
          evaluation: PateEvaluation.FAVORABLE,
        },
        actor,
        db as any
      ),
      (err: unknown) => {
        assert(err instanceof HttpError)
        assert.equal(err.status, 409)
        assert.match(err.message, /ciclo lectivo distinto/)
        return true
      }
    )
  })

  it('rechaza si la reunión está firmada y el alumno no fue tratado (409)', async () => {
    const { db } = fakeDb({ meetingStatus: 'SIGNED', studentTreated: false })
    await assert.rejects(
      createPateFollowUp(
        'pate-1',
        {
          edteMeetingId: 'meet-1',
          progress: 'Avance',
          evaluation: PateEvaluation.FAVORABLE,
        },
        actor,
        db as any
      ),
      (err: unknown) => {
        assert(err instanceof HttpError)
        assert.equal(err.status, 409)
        assert.match(err.message, /no fue tratado en esa reunión/)
        return true
      }
    )
  })

  it('crea seguimiento y vincula automáticamente si la reunión está en borrador', async () => {
    const { db, calls } = fakeDb({ meetingStatus: 'DRAFT', studentTreated: false })
    const res = await createPateFollowUp(
      'pate-1',
      {
        edteMeetingId: 'meet-1',
        progress: 'Avance satisfactorio',
        evaluation: PateEvaluation.FAVORABLE,
        observations: 'Buena predisposición',
      },
      actor,
      db as any
    )

    assert.equal(res.id, 'fu-1')
    assert.equal(res.progress, 'Avance satisfactorio')
    assert.equal(calls.edteStudentsCreated.length, 1)
    assert.equal(calls.followUpsCreated.length, 1)
    assert.equal(calls.auditsCreated.length, 1)
  })
})
