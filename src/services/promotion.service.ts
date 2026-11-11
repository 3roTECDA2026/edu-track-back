import { PrismaClient, PromotionOutcome } from '@prisma/client'
import { HttpError } from '@/utils/httpError'

const prisma = new PrismaClient()

/**
 * Decide el resultado de promoción basándose en la cantidad de MPAA.
 * Función pura para facilitar tests y mantenimiento.
 *
 * @param pendingCount - Cantidad de materias pendientes (MPAA) del alumno
 * @returns PromotionOutcome.PROMOTED si < 5, REFERRED_TO_EDTE si >= 5
 */
export function decideOutcome(pendingCount: number): PromotionOutcome {
  return pendingCount >= 5 ? PromotionOutcome.REFERRED_TO_EDTE : PromotionOutcome.PROMOTED
}

/** Validar que el ciclo lectivo esté activo (no cerrado). */
export async function validateCycleClosed(academicYearId: string): Promise<void> {
  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { active: true },
  })

  if (!year || !year.active) {
    throw new HttpError(
      409,
      'No se puede ejecutar el motor de promoción: el ciclo lectivo no está activo (ya está cerrado).'
    )
  }
}

/**
 * Ejecuta el motor de promoción para un ciclo académico.
 * 
 * Lógica:
   - Agrupa los pendingSubjects por estudiante
   - Para cada alumno, cuenta sus MPAA pendientes
   - Aplica la regla: >= 5 MPAA → derivado al EDTE, < 5 → promovido
   - Crea promotionDecision con auditoría
   - Retorna las decisiones generadas
   
 * Validaciones:
   - Lanza 409 si el ciclo no está activo (cerrado)
   - Lanza 409 si ya hay decisiones para este ciclo (evita re-ejecución)
   - Transacción Serializable para prevenir ejecuciones simultáneas
   - Evita duplicados checking decisions existentes
 */
export async function runPromotion(
  academicYearId: string,
  executedById: string
): Promise<PromotionOutcome[]> {
  // 1. Validar que el ciclo esté activo (no cerrado)
  await validateCycleClosed(academicYearId)

  // 2. Ejecutar en transacción Serializable para prevenir carreras de fondo
  const result = await prisma.$transaction(
    async (tx) => {
      // Verificar si ya hay decisiones para este ciclo (evitar re-ejecución)
      const existingDecisions = await tx.promotionDecision.findMany({
        where: { academicYearId },
      })

      if (existingDecisions.length > 0) {
        throw new HttpError(
          409,
          'Ya existen decisiones de promoción para este ciclo lectivo. No se permite re-ejecución.'
        )
      }

      const pending = await tx.pendingSubject.groupBy({
        by: ['studentId'],
        where: { status: 'PENDING', originAcademicYearId: academicYearId },
        _count: { _all: true },
      })

      const outcomes: PromotionOutcome[] = []
      for (const row of pending) {
        const count = row._count._all
        const outcome = decideOutcome(count)

        const decision = await tx.promotionDecision.create({
          data: {
            studentId: row.studentId,
            academicYearId,
            pendingCount: count,
            outcome,
            executedById,
          },
        })
        outcomes.push(outcome)
      }
      return outcomes
    },
    { isolationLevel: 'Serializable' }
  )

  return result
}
