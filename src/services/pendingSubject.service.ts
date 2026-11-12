import { PendingSubjectStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  ListPendingSubjectsQuery,
  UpdatePendingKnowledgeInput,
} from '@/schemas/pendingSubject.schema'
import { HttpError } from '@/utils/httpError'
import { toAttemptsResponse } from '@/utils/pendingAttempts'

// Saberes pendientes por materia (E3-RF-02, CRM-053): se registran, en texto, al inicio y al
// cierre del ciclo. Son el estado actual de la MPAA; la historia de cada ciclo sale de sus
// intentos de intensificación.

const pendingSubjectSelect = {
  id: true,
  status: true,
  initialPendingKnowledge: true,
  closingPendingKnowledge: true,
  finalScore: true,
  accreditedAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true, gradeLevel: true } },
  originAcademicYear: { select: { id: true, year: true } },
} satisfies Prisma.PendingSubjectSelect

// Las MPAA de un alumno: primero las pendientes y, dentro de cada grupo, el ciclo más reciente
export async function listPendingSubjects(query: ListPendingSubjectsQuery) {
  const student = await prisma.student.findUnique({
    where: { id: query.studentId },
    select: { id: true },
  })
  if (!student) throw new HttpError(404, 'Estudiante no encontrado')

  return prisma.pendingSubject.findMany({
    where: { studentId: query.studentId },
    select: pendingSubjectSelect,
    orderBy: [
      { status: 'asc' },
      { originAcademicYear: { year: 'desc' } },
      { subject: { name: 'asc' } },
    ],
  })
}

// Guarda los saberes pendientes. Una MPAA ya acreditada no tiene saberes por completar
export async function updatePendingKnowledge(
  id: string,
  input: UpdatePendingKnowledgeInput,
  db: Pick<Prisma.TransactionClient, 'pendingSubject'> = prisma
) {
  const pending = await db.pendingSubject.findUnique({
    where: { id },
    select: { status: true, subject: { select: { name: true } } },
  })
  if (!pending) throw new HttpError(404, 'Materia pendiente no encontrada')
  if (pending.status === PendingSubjectStatus.ACCREDITED) {
    throw new HttpError(
      409,
      `${pending.subject.name} ya está acreditada: no se pueden cambiar sus saberes pendientes`
    )
  }

  return db.pendingSubject.update({
    where: { id },
    data: {
      ...(input.initialPendingKnowledge !== undefined && {
        initialPendingKnowledge: input.initialPendingKnowledge,
      }),
      ...(input.closingPendingKnowledge !== undefined && {
        closingPendingKnowledge: input.closingPendingKnowledge,
      }),
    },
    select: pendingSubjectSelect,
  })
}
// Historial de intentos de intensificación de una MPAA, del más viejo al más nuevo (E3-RF-03).
// Los intentos cuelgan de la cursada que originó la MPAA. Sin intentos devuelve una lista vacía.
export async function listPendingSubjectAttempts(
  id: string,
  db: Pick<Prisma.TransactionClient, 'pendingSubject'> = prisma
) {
  const pending = await db.pendingSubject.findUnique({
    where: { id },
    select: {
      originEnrollment: {
        select: {
          intensifications: {
            select: {
              id: true,
              period: true,
              model: true,
              resultCode: true,
              score: true,
              evaluationDate: true,
              createdAt: true,
              schedule: {
                select: {
                  startDate: true,
                  endDate: true,
                  academicYear: { select: { year: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!pending) throw new HttpError(404, 'Materia pendiente no encontrada')

  return toAttemptsResponse(pending.originEnrollment.intensifications)
}
