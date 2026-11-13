import { z } from 'zod'

export const runPromotionSchema = z.object({
  academicYearId: z.guid('El ID del ciclo lectivo debe ser un UUID válido'),
})

export type RunPromotionInput = z.infer<typeof runPromotionSchema>
