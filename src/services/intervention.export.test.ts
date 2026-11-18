import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Role } from '@prisma/client'

import { HttpError } from '@/utils/httpError'
import { attachmentDisposition } from '@/utils/contentDisposition'

import { assertCanExportStudent, type StudentAccessDb } from './intervention.service'

// Base falsa: el docente d1 da clases en el curso cs1. El alumno s1 cursó en cs1; s2 nunca.
const fakeDb = () => {
  const enrollmentQueries: unknown[] = []
  const db = {
    teacherSubjectCourse: {
      findMany: async ({ where }: { where: { teacherId: string } }) =>
        where.teacherId === 'd1'
          ? [{ classSectionId: 'cs1' }, { classSectionId: 'cs1' }] // dos materias en el mismo curso
          : [],
    },
    enrollmentHistory: {
      findFirst: async (args: {
        where: { studentId: string; classSectionId: { in: string[] } }
      }) => {
        enrollmentQueries.push(args)
        const { studentId, classSectionId } = args.where
        return studentId === 's1' && classSectionId.in.includes('cs1') ? { id: 'e1' } : null
      },
    },
  }
  return { db: db as unknown as StudentAccessDb, enrollmentQueries }
}

const is404 = (err: unknown) => err instanceof HttpError && err.status === 404

describe('quién puede exportar el PDF de un alumno (revisión de CRM-088)', () => {
  it('un docente puede exportar el de un alumno de sus cursos', async () => {
    const { db } = fakeDb()
    await assert.doesNotReject(
      assertCanExportStudent('s1', { userId: 'd1', role: Role.TEACHER }, db)
    )
  })

  it('un docente recibe 404 con un alumno ajeno, igual que si no existiera', async () => {
    const { db } = fakeDb()
    await assert.rejects(
      assertCanExportStudent('s2', { userId: 'd1', role: Role.TEACHER }, db),
      is404
    )
  })

  it('un docente sin cursos asignados recibe 404 y no consulta inscripciones', async () => {
    const { db, enrollmentQueries } = fakeDb()
    await assert.rejects(
      assertCanExportStudent('s1', { userId: 'd9', role: Role.TEACHER }, db),
      is404
    )
    assert.equal(enrollmentQueries.length, 0)
  })

  it('los demás roles pueden exportar el de cualquier alumno, sin consultar la base', async () => {
    const { db, enrollmentQueries } = fakeDb()
    for (const role of [
      Role.ADMINISTRATOR,
      Role.SCHOOL_MANAGEMENT,
      Role.EOE_DIRECTIVE,
      Role.PRECEPTOR,
    ]) {
      await assert.doesNotReject(assertCanExportStudent('s2', { userId: 'x', role }, db))
    }
    assert.equal(enrollmentQueries.length, 0)
  })
})

describe('nombre del PDF exportado', () => {
  it('un apellido con apóstrofo no rompe el encabezado', () => {
    const header = attachmentDisposition("intervenciones-D'Angelo.pdf")
    assert.ok(header.includes("filename*=UTF-8''intervenciones-D%27Angelo.pdf"))
    assert.ok(header.includes('filename="intervenciones-D\'Angelo.pdf"'))
  })

  it('con tildes y ñ, suma un nombre de respaldo solo ASCII', () => {
    const header = attachmentDisposition('intervenciones-Muñoz Pérez.pdf')
    assert.ok(header.includes('filename="intervenciones-Munoz Perez.pdf"'))
  })
})
