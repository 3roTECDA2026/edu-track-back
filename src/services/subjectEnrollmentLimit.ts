import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

// E3-RF-13: máximo de materias por alumno en un mismo ciclo lectivo (cursadas y recursadas)
export const MAX_SUBJECTS_PER_CYCLE = 12

/**
 * Rechaza con 409 si inscribir `toAdd` materias más deja al alumno por encima del máximo del ciclo.
 * Cuenta todas las inscripciones del ciclo, sin importar courseType ni subjectStatus.
 * Pasá `db` con el cliente de la transacción cuando el endpoint inscriba dentro de una.
 */
export async function assertSubjectLimit(
  studentId: string,
  academicYearId: string,
  toAdd = 1,
  db: Pick<Prisma.TransactionClient, 'enrollment'> = prisma
) {
  const current = await db.enrollment.count({ where: { studentId, academicYearId } })

  if (current + toAdd > MAX_SUBJECTS_PER_CYCLE) {
    throw new HttpError(
      409,
      `El alumno ya tiene ${current} materias en este ciclo lectivo y el máximo permitido es ${MAX_SUBJECTS_PER_CYCLE}.`
    )
  }
}
