import { z } from 'zod'

export const continueMatriculationSchema = z
  .object({
    fromYearId: z.guid('El ID del ciclo lectivo de origen debe ser un UUID válido'),
    toYearId: z.guid('El ID del ciclo lectivo de destino debe ser un UUID válido'),
  })
  .refine((data) => data.fromYearId !== data.toYearId, {
    message: 'El ciclo lectivo de origen y destino deben ser diferentes',
    path: ['toYearId'],
  })

export type ContinueMatriculationInput = z.infer<typeof continueMatriculationSchema>
