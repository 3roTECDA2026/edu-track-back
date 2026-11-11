import { PendingSubjectStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type {
  ListPendingSubjectsQuery,
  UpdatePendingKnowledgeInput,
} from '@/schemas/pendingSubject.schema'
import { HttpError } from '@/utils/httpError'

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
