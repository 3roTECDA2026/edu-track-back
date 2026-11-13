import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CourseType } from '@prisma/client'

import { HttpError } from '@/utils/httpError'

import { deleteSubjectRepeat, updateSubjectRepeat } from './subjectRepeat.service'

type Db = NonNullable<Parameters<typeof updateSubjectRepeat>[3]>

const actor = { userId: 'u1', ipAddress: '127.0.0.1' }
const cycle2026 = { id: 'y2026', year: 2026 }
// Sección nueva: 2° B Tarde de 2026
const newSection = {
  id: 'sec-2b',
  grade: 2,
  division: 'B',
  shift: 'AFTERNOON',
  academicYearId: 'y2026',
}

// Recursado de Geografía (2.º año) en 2° A de 2026. Con `fromPate`, lo creó un PATE
const repeat = (fromPate: boolean) => ({
  id: 'r1',
  courseType: CourseType.REPEAT,
  studentId: 's1',
  subjectId: 'geo',
  academicYearId: 'y2026',
  originalGradeLevel: 2,
  repeatedPendingSubjectId: 'p-geo',
  student: { id: 's1', dni: '1', firstName: 'Mateo', lastName: 'García' },
  subject: { id: 'geo', name: 'Geografía', gradeLevel: 2 },
  classSection: { id: 'sec-2a', grade: 2, division: 'A', shift: 'MORNING' },
  academicYear: cycle2026,
  repeatedPendingSubject: { id: 'p-geo', status: 'PENDING', originAcademicYear: { year: 2025 } },
  grade: null,
  _count: { subjectAttendances: 0, intensifications: 0 },
  pateRepeatOrigin: fromPate ? { id: 'psr1', pateId: 'pate1' } : null,
})

// Transacción falsa: devuelve el recursado y anota lo que se intenta guardar o borrar
function fakeDb(fromPate: boolean) {
  const calls = { deleted: [] as unknown[], pateUpdates: [] as unknown[], audits: [] as unknown[] }
  const tx = {
    enrollment: {
      findUnique: async () => repeat(fromPate),
      update: async () => ({ ...repeat(fromPate), classSection: newSection }),
      delete: async (args: unknown) => calls.deleted.push(args),
    },
    academicYear: { findFirst: async () => cycle2026 },
    classSection: { findUnique: async () => newSection },
    pateSubjectRepeat: { update: async (args: unknown) => calls.pateUpdates.push(args) },
    auditLog: { create: async (args: unknown) => calls.audits.push(args) },
  }
  const db = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as Db
  return { db, calls }
}

describe('quitar un recursado (CRM-082)', () => {
  it('si lo creó un PATE, responde 409 y no lo borra', async () => {
    const { db, calls } = fakeDb(true)
    await assert.rejects(
      deleteSubjectRepeat('r1', actor, db),
      (err: unknown) =>
        err instanceof HttpError && err.status === 409 && /lo creó un PATE/.test(err.message)
    )
    assert.equal(calls.deleted.length, 0)
  })

  it('si se asignó a mano y no tiene notas ni asistencias, lo borra', async () => {
    const { db, calls } = fakeDb(false)
    assert.deepEqual(await deleteSubjectRepeat('r1', actor, db), { deleted: true })
    assert.equal(calls.deleted.length, 1)
  })
})

describe('cambiar la sección de un recursado (CRM-082)', () => {
  it('si lo creó un PATE, también cambia la sección en el PATE', async () => {
    const { db, calls } = fakeDb(true)
    const updated = await updateSubjectRepeat('r1', { classSectionId: 'sec-2b' }, actor, db)
    assert.equal(updated.classSection.id, 'sec-2b')
    assert.equal(updated.pateId, 'pate1')
    assert.deepEqual(calls.pateUpdates, [
      { where: { id: 'psr1' }, data: { classSectionId: 'sec-2b' } },
    ])
  })

  it('si se asignó a mano, no toca ningún PATE', async () => {
    const { db, calls } = fakeDb(false)
    const updated = await updateSubjectRepeat('r1', { classSectionId: 'sec-2b' }, actor, db)
    assert.equal(updated.pateId, null)
    assert.equal(calls.pateUpdates.length, 0)
  })
})
