import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

// E3-RF-13: máximo de materias por alumno en un mismo ciclo lectivo (cursadas y recursadas)
export const MAX_SUBJECTS_PER_CYCLE = 12

/**
 * Rechaza con 409 si inscribir `toAdd` materias más deja al alumno por encima del máximo del ciclo.
 * Cuenta todas las inscripciones del ciclo, sin importar courseType ni subjectStatus.
 *
 * Concurrencia: contar y después crear no es atómico. Dos pedidos simultáneos pueden leer el mismo
 * total y pasarse del máximo. El endpoint que use este helper tiene que llamarlo dentro de una
 * transacción (pasando el cliente `tx` en `db`) y serializar por alumno antes de contar, por
 * ejemplo bloqueando su fila con SELECT ... FOR UPDATE, o con aislamiento Serializable y reintento.
 * Una transacción por sí sola no alcanza.
 */
export async function assertSubjectLimit(
  studentId: string,
  academicYearId: string,
  toAdd = 1,
  db: Pick<Prisma.TransactionClient, 'enrollment'> = prisma
) {
  if (!Number.isInteger(toAdd) || toAdd < 1) {
    throw new RangeError('toAdd debe ser un entero positivo')
  }

  const current = await db.enrollment.count({ where: { studentId, academicYearId } })

    const total = current + toAdd

  if (total > MAX_SUBJECTS_PER_CYCLE) {
    const nuevas = toAdd === 1 ? 'la nueva' : `las ${toAdd} nuevas`
    throw new HttpError(
      409,
      `El alumno tiene ${current} materias en este ciclo lectivo; con ${nuevas} serían ${total} y el máximo permitido es ${MAX_SUBJECTS_PER_CYCLE}.`
    )
  }
}
