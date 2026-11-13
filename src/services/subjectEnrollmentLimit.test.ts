import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { HttpError } from '@/utils/httpError'

import { assertSubjectLimit, MAX_SUBJECTS_PER_CYCLE } from './subjectEnrollmentLimit'

// Cliente falso: devuelve la cantidad indicada y guarda con qué filtro se le preguntó
function fakeDb(count: number) {
  const calls: unknown[] = []
  const db = {
    enrollment: {
      count: async (args: unknown) => {
        calls.push(args)
        return count
      },
    },
  }
  return { db: db as never, calls }
}

const isConflict = (err: unknown) => err instanceof HttpError && err.status === 409

describe('assertSubjectLimit (E3-RF-13)', () => {
  it('el máximo es 12', () => {
    assert.equal(MAX_SUBJECTS_PER_CYCLE, 12)
  })

  it('permite inscribir hasta llegar justo a 12', async () => {
    await assertSubjectLimit('alumno', 'ciclo', 1, fakeDb(0).db)
    await assertSubjectLimit('alumno', 'ciclo', 1, fakeDb(11).db)
  })

  it('rechaza con 409 cuando la inscripción pasa de 12', async () => {
    await assert.rejects(assertSubjectLimit('alumno', 'ciclo', 1, fakeDb(12).db), isConflict)
  })

  it('varias materias a la vez: 10 + 2 entra, 10 + 3 no', async () => {
    await assertSubjectLimit('alumno', 'ciclo', 2, fakeDb(10).db)
    await assert.rejects(assertSubjectLimit('alumno', 'ciclo', 3, fakeDb(10).db), isConflict)
  })

  it('el mensaje dice cuántas tiene y cuál es el máximo', async () => {
    await assert.rejects(
      assertSubjectLimit('alumno', 'ciclo', 1, fakeDb(12).db),
      /tiene 12 materias.*máximo permitido es 12/
    )
  })

  it('cuenta las materias del alumno en ese ciclo, cursadas y recursadas juntas', async () => {
    const { db, calls } = fakeDb(3)
    await assertSubjectLimit('alumno-1', 'ciclo-1', 1, db)
    // El filtro es solo alumno + ciclo: sin courseType ni estado de la materia
    assert.deepEqual(calls, [{ where: { studentId: 'alumno-1', academicYearId: 'ciclo-1' } }])
  })

  it('rechaza un toAdd que no sea entero positivo', async () => {
    for (const invalid of [0, -1, 1.5, Number.NaN]) {
      await assert.rejects(assertSubjectLimit('alumno', 'ciclo', invalid, fakeDb(0).db), RangeError)
    }
  })
})
