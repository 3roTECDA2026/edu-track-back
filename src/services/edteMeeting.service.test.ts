import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'

import { AuditActionType, EdteMeetingStatus, Role } from '@prisma/client'

import { minutesContentHash, toMinutesSnapshot } from '@/utils/edteMinutesPdf'
import { HttpError } from '@/utils/httpError'

import { getEdteMeetingMinutes, signEdteMeeting, updateEdteMeeting } from './edteMeeting.service'

// Firma del acta y acta en PDF de las reuniones del EDTE (CRM-076), con una base falsa en memoria

const actor = (userId: string) => ({ userId, ipAddress: '127.0.0.1' })
const viewer = (userId: string, role: Role) => ({ ...actor(userId), role })

interface MemberSeed {
  userId: string
  present: boolean
  signedAt?: Date
}

function fakeDb(
  options: {
    date?: string
    status?: EdteMeetingStatus
    members?: MemberSeed[]
    snapshot?: unknown
  } = {}
) {
  const seeds = options.members ?? [
    { userId: 'u1', present: true },
    { userId: 'u2', present: true },
  ]
  const meeting = {
    id: 'm1',
    date: new Date(`${options.date ?? '2026-03-02'}T00:00:00.000Z`),
    period: 'FEBRUARY_MARCH',
    shift: null,
    academicYearId: 'y2026',
    academicYear: { id: 'y2026', year: 2026 },
    considerations: 'Acuerdos de la reunión',
    minutesUrl: null as string | null,
    minutesSnapshot: (options.snapshot ?? null) as unknown,
    status: options.status ?? EdteMeetingStatus.DRAFT,
    signedAt: null as Date | null,
    signedById: null as string | null,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    createdBy: null,
    signedBy: null,
    members: seeds.map((seed, index) => ({
      id: `em${index + 1}`,
      edteMeetingId: 'm1',
      userId: seed.userId,
      present: seed.present,
      roleInMeeting: 'TEACHER',
      signedAt: (seed.signedAt ?? null) as Date | null,
      signatureHash: (seed.signedAt ? 'f'.repeat(64) : null) as string | null,
      user: {
        id: seed.userId,
        firstName: 'Ana',
        lastName: `Integrante ${seed.userId}`,
        role: 'TEACHER',
      },
    })),
    students: [],
    pates: [],
  }
  const calls = { audits: [] as any[], institutionReads: 0 }

  // Filtro de las firmas como lo usa el service: signedAt null (sin firmar) o { not: null }
  const matches = (member: (typeof meeting.members)[number], where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'edteMeetingId') return value === meeting.id
      if (key === 'signedAt') return value === null ? !member.signedAt : Boolean(member.signedAt)
      return member[key as keyof typeof member] === value
    })

  const tx = {
    $queryRaw: async () => [],
    edteMeeting: {
      findUnique: async () => meeting,
      update: async ({ data }: any) => Object.assign(meeting, data),
    },
    edteMember: {
      updateMany: async ({ where, data }: any) => {
        const found = meeting.members.filter((member) => matches(member, where))
        found.forEach((member) => Object.assign(member, data))
        return { count: found.length }
      },
      count: async ({ where }: any) =>
        meeting.members.filter((member) => matches(member, where)).length,
    },
    enrollmentHistory: { findMany: async () => [] },
    pendingSubject: { groupBy: async () => [] },
    institutionalConfig: {
      findUnique: async () => {
        calls.institutionReads += 1
        return null
      },
    },
    auditLog: { create: async ({ data }: any) => calls.audits.push(data) },
  }
  const db = { ...tx, $transaction: async (run: (client: typeof tx) => unknown) => run(tx) }

  return { db: db as any, meeting, calls }
}

const rejectsWith = (status: number, message: RegExp) => (err: unknown) => {
  assert(err instanceof HttpError)
  assert.equal(err.status, status)
  assert.match(err.message, message)
  return true
}

describe('firma del acta del EDTE (CRM-076)', () => {
  it('un presente firma y, si faltan otros, la reunión sigue en borrador', async () => {
    const { db, meeting, calls } = fakeDb()
    await signEdteMeeting('m1', actor('u1'), db)

    const signer = meeting.members.find((member) => member.userId === 'u1')
    assert.ok(signer?.signedAt)
    assert.match(signer?.signatureHash ?? '', /^[0-9a-f]{64}$/)
    assert.equal(meeting.status, EdteMeetingStatus.DRAFT)
    assert.equal(meeting.minutesSnapshot, null)
    assert.equal(calls.audits.length, 1)
    assert.equal(calls.audits[0].action, AuditActionType.SIGN)
    assert.match(calls.audits[0].newData.contentHash, /^[0-9a-f]{64}$/)
  })

  it('cuando firma el último presente, la reunión queda firmada con la copia fija del acta', async () => {
    const { db, meeting } = fakeDb({
      members: [
        { userId: 'u1', present: true, signedAt: new Date('2026-03-02T15:00:00.000Z') },
        { userId: 'u2', present: true },
        { userId: 'u3', present: false },
      ],
    })
    await signEdteMeeting('m1', actor('u2'), db)

    assert.equal(meeting.status, EdteMeetingStatus.SIGNED)
    assert.equal(meeting.minutesUrl, '/api/edte-meetings/m1/minutes')
    const snapshot = meeting.minutesSnapshot as ReturnType<typeof toMinutesSnapshot>
    assert.equal(snapshot.signed, true)
    assert.equal(snapshot.considerations, 'Acuerdos de la reunión')
    assert.deepEqual(
      snapshot.members.map((member) => [member.userId, Boolean(member.signedAt)]),
      [
        ['u1', true],
        ['u2', true],
        ['u3', false],
      ]
    )
  })

  it('la huella se puede recalcular: reunión + integrante + fecha y hora + contenido del acta', async () => {
    const { db, meeting, calls } = fakeDb()
    await signEdteMeeting('m1', actor('u1'), db)

    // El contenido que firmó: el acta tal como estaba (sin firmas)
    const contentHash = minutesContentHash({
      institution: 'Institución sin configurar',
      year: 2026,
      date: '2026-03-02',
      period: 'FEBRUARY_MARCH',
      shift: null,
      considerations: 'Acuerdos de la reunión',
      signed: false,
      signedAt: null,
      members: ['u1', 'u2'].map((userId) => ({
        userId,
        name: `Integrante ${userId}, Ana`,
        role: 'TEACHER',
        present: true,
        signedAt: null,
        signatureHash: null,
      })),
      students: [],
    })
    assert.equal(calls.audits[0].newData.contentHash, contentHash)

    const signer = meeting.members.find((member) => member.userId === 'u1')
    const expected = createHash('sha256')
      .update(`m1:u1:${signer?.signedAt?.toISOString()}:${contentHash}`)
      .digest('hex')
    assert.equal(signer?.signatureHash, expected)
  })

  it('una reunión sin integrantes presentes no se puede firmar (409)', async () => {
    const { db } = fakeDb({
      members: [
        { userId: 'u1', present: false },
        { userId: 'u2', present: false },
      ],
    })
    await assert.rejects(
      signEdteMeeting('m1', actor('u1'), db),
      rejectsWith(409, /no tiene integrantes presentes/)
    )
  })

  it('si los datos cambian después de firmar, la copia fija del acta no cambia', async () => {
    const { db, meeting } = fakeDb({ members: [{ userId: 'u1', present: true }] })
    await signEdteMeeting('m1', actor('u1'), db)

    const member = meeting.members[0]
    assert.ok(member)
    meeting.considerations = 'Cambiado después de firmar'
    member.user.lastName = 'Otro apellido'

    const snapshot = meeting.minutesSnapshot as ReturnType<typeof toMinutesSnapshot>
    assert.equal(snapshot.considerations, 'Acuerdos de la reunión')
    assert.equal(snapshot.members[0]?.name, 'Integrante u1, Ana')
  })

  it('quien estuvo ausente no puede firmar (403)', async () => {
    const { db } = fakeDb({
      members: [
        { userId: 'u1', present: false },
        { userId: 'u2', present: true },
      ],
    })
    await assert.rejects(signEdteMeeting('m1', actor('u1'), db), rejectsWith(403, /presentes/))
  })

  it('quien no fue convocado no puede firmar (403)', async () => {
    const { db } = fakeDb()
    await assert.rejects(signEdteMeeting('m1', actor('u9'), db), rejectsWith(403, /presentes/))
  })

  it('no se puede firmar dos veces (409)', async () => {
    const { db } = fakeDb({
      members: [{ userId: 'u1', present: true, signedAt: new Date('2026-03-02T15:00:00.000Z') }],
    })
    await assert.rejects(signEdteMeeting('m1', actor('u1'), db), rejectsWith(409, /Ya firmaste/))
  })

  it('no se puede firmar una reunión que todavía no ocurrió (409)', async () => {
    const { db } = fakeDb({ date: '2999-03-02' })
    await assert.rejects(
      signEdteMeeting('m1', actor('u1'), db),
      rejectsWith(409, /todavía no ocurrió/)
    )
  })

  it('no se puede firmar una reunión ya firmada (409)', async () => {
    const { db } = fakeDb({ status: EdteMeetingStatus.SIGNED })
    await assert.rejects(
      signEdteMeeting('m1', actor('u1'), db),
      rejectsWith(409, /ya está firmada/)
    )
  })
})

describe('edición de una reunión con firmas (CRM-076)', () => {
  it('editar el borrador borra las firmas que ya había', async () => {
    const { db, meeting } = fakeDb({
      members: [
        { userId: 'u1', present: true, signedAt: new Date('2026-03-02T15:00:00.000Z') },
        { userId: 'u2', present: true },
      ],
    })
    await updateEdteMeeting('m1', { considerations: 'Acuerdos corregidos' } as any, actor('u1'), db)

    assert.equal(meeting.considerations, 'Acuerdos corregidos')
    assert.ok(meeting.members.every((member) => !member.signedAt && !member.signatureHash))
  })

  it('una reunión firmada no se puede editar (409)', async () => {
    const { db } = fakeDb({ status: EdteMeetingStatus.SIGNED })
    await assert.rejects(
      updateEdteMeeting('m1', { considerations: 'Cambio' } as any, actor('u1'), db),
      rejectsWith(409, /ya está firmada/)
    )
  })
})

describe('acta en PDF (CRM-076)', () => {
  it('en borrador se arma con los datos de ahora y se registra quién la descargó', async () => {
    const { db, calls } = fakeDb()
    const { fileName, content } = await getEdteMeetingMinutes('m1', viewer('u1', Role.TEACHER), db)

    assert.equal(fileName, 'acta-edte-2026-03-02.pdf')
    assert.equal(content.subarray(0, 5).toString(), '%PDF-')
    assert.equal(calls.institutionReads, 1)
    assert.equal(calls.audits.length, 1)
    assert.equal(calls.audits[0].action, AuditActionType.SENSITIVE_VIEW)
  })

  it('firmada, sale de la copia fija y no de los datos de ahora', async () => {
    const snapshot = toMinutesSnapshot({
      institution: 'Escuela Normal',
      year: 2026,
      date: '2026-03-02',
      period: 'FEBRUARY_MARCH',
      shift: null,
      considerations: 'Acuerdos firmados',
      signed: true,
      signedAt: new Date('2026-03-02T15:00:00.000Z'),
      members: [],
      students: [],
    })
    const { db, calls } = fakeDb({ status: EdteMeetingStatus.SIGNED, snapshot })
    const { content } = await getEdteMeetingMinutes('m1', viewer('u1', Role.TEACHER), db)

    assert.equal(content.subarray(0, 5).toString(), '%PDF-')
    // No volvió a leer los datos de la institución: usó la copia fija
    assert.equal(calls.institutionReads, 0)
    assert.equal(calls.audits[0].action, AuditActionType.SENSITIVE_VIEW)
  })

  it('un docente que no fue convocado no puede bajar el acta (403) y no queda registrado', async () => {
    const { db, calls } = fakeDb()
    await assert.rejects(
      getEdteMeetingMinutes('m1', viewer('u9', Role.TEACHER), db),
      rejectsWith(403, /convocados/)
    )
    assert.equal(calls.audits.length, 0)
  })

  it('un integrante convocado la baja aunque haya estado ausente', async () => {
    const { db } = fakeDb({ members: [{ userId: 'u2', present: false }] })
    const { content } = await getEdteMeetingMinutes('m1', viewer('u2', Role.PRECEPTOR), db)
    assert.equal(content.subarray(0, 5).toString(), '%PDF-')
  })

  it('quien gestiona las reuniones la baja aunque no haya sido convocado', async () => {
    const { db } = fakeDb()
    const { content } = await getEdteMeetingMinutes('m1', viewer('u9', Role.EOE_DIRECTIVE), db)
    assert.equal(content.subarray(0, 5).toString(), '%PDF-')
  })
})
