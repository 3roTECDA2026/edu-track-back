import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PendingSubjectStatus } from '@prisma/client'

import { HttpError } from '@/utils/httpError'

import { listPendingSubjects, updatePendingKnowledge } from './pendingSubject.service'

type Db = Parameters<typeof updatePendingKnowledge>[2]

// Base falsa: devuelve la MPAA indicada y anota lo que se intenta guardar
const fakeDb = (found: { status: PendingSubjectStatus; subject: { name: string } } | null) => {
  const updates: Array<{ data: unknown }> = []
  const db = {
    pendingSubject: {
      findUnique: async () => found,
      update: async (args: { data: unknown }) => {
        updates.push(args)
        // Lo que devuelve Prisma con el select del service (CRM-097: incluye la cursada de origen)
        return {
          subject: { name: 'Lengua', gradeLevel: 1 },
          originEnrollment: { originalGradeLevel: 2 },
        }
      },
    },
  } as unknown as Db
  return { db, updates }
}

const pending = { status: PendingSubjectStatus.PENDING, subject: { name: 'Lengua' } }
const accredited = { status: PendingSubjectStatus.ACCREDITED, subject: { name: 'Lengua' } }
const isStatus = (status: number) => (err: unknown) =>
  err instanceof HttpError && err.status === status

describe('guardar los saberes de una MPAA', () => {
  it('404 si la MPAA no existe', async () => {
    const { db } = fakeDb(null)
    await assert.rejects(
      updatePendingKnowledge('id', { closingPendingKnowledge: 'x' }, db),
      isStatus(404)
    )
  })

  it('409 si la MPAA ya está acreditada, y no guarda nada', async () => {
    const { db, updates } = fakeDb(accredited)
    await assert.rejects(
      updatePendingKnowledge('id', { closingPendingKnowledge: 'x' }, db),
      isStatus(409)
    )
    assert.equal(updates.length, 0)
  })

  it('guarda solo el campo que llegó', async () => {
    const { db, updates } = fakeDb(pending)
    await updatePendingKnowledge('id', { closingPendingKnowledge: 'Argumentación' }, db)
    assert.deepEqual(updates[0]?.data, { closingPendingKnowledge: 'Argumentación' })
  })

  it('la respuesta trae el año de la cursada de origen (CRM-097)', async () => {
    const { db } = fakeDb(pending)
    const saved = await updatePendingKnowledge('id', { closingPendingKnowledge: 'x' }, db)
    assert.equal(saved.gradeLevel, 2)
  })

  it('null borra el campo', async () => {
    const { db, updates } = fakeDb(pending)
    await updatePendingKnowledge('id', { initialPendingKnowledge: null }, db)
    assert.deepEqual(updates[0]?.data, { initialPendingKnowledge: null })
  })
})

type ListDb = Parameters<typeof listPendingSubjects>[1]

// Base falsa para el listado: el alumno existe o no, y devuelve las filas indicadas
const fakeListDb = (studentExists: boolean, rows: unknown[]) => {
  const queries: Array<{ select?: Record<string, unknown> }> = []
  const db = {
    student: { findUnique: async () => (studentExists ? { id: 'alumno' } : null) },
    pendingSubject: {
      findMany: async (args: { select?: Record<string, unknown> }) => {
        queries.push(args)
        return rows
      },
    },
  } as unknown as ListDb
  return { db, queries }
}

// Fila como la devuelve Prisma con el select del service
const row = (id: string, gradeLevel: number, originalGradeLevel: number | null) => ({
  id,
  status: PendingSubjectStatus.PENDING,
  subject: { id: `mat-${id}`, name: 'Matemática', gradeLevel },
  originAcademicYear: { id: 'c2025', year: 2025 },
  originEnrollment: { originalGradeLevel },
})

describe('listar las MPAA de un alumno (CRM-097)', () => {
  it('404 si el alumno no existe, sin consultar las MPAA', async () => {
    const { db, queries } = fakeListDb(false, [])
    await assert.rejects(listPendingSubjects({ studentId: 'x' }, db), isStatus(404))
    assert.equal(queries.length, 0)
  })

  it('pide la cursada de origen y la transforma en gradeLevel sin exponerla', async () => {
    const { db, queries } = fakeListDb(true, [row('a', 1, 2), row('b', 3, null)])
    const list = await listPendingSubjects({ studentId: 'alumno' }, db)

    assert.ok(queries[0]?.select?.originEnrollment, 'el select incluye la cursada de origen')
    assert.deepEqual(
      list.map((item) => item.gradeLevel),
      [2, 3]
    )
    assert.ok(list.every((item) => !('originEnrollment' in item)))
    assert.equal(list[0]?.subject.gradeLevel, 1)
  })
})
