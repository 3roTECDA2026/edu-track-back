import { IntensificationModel, IntensificationResultCode } from '@prisma/client'
import { z } from 'zod'

// Modelos que se cursan en otra sección: ahí es obligatorio indicar año, sección y turno (E3-RF-07)
export const MODELS_WITH_LOCATION: IntensificationModel[] = [
  IntensificationModel.MODEL_2,
  IntensificationModel.MODEL_3,
]

// Modelo y ubicación: en los modelos 2 y 3 la sección es obligatoria; en el 1 y el 4 no va
function checkPlacement(
  data: { model: IntensificationModel; targetClassSectionId?: string | null },
  context: z.RefinementCtx
) {
  const needsLocation = MODELS_WITH_LOCATION.includes(data.model)
  if (needsLocation && !data.targetClassSectionId) {
    context.addIssue({
      code: 'custom',
      message: 'En los modelos 2 y 3 hay que indicar el año, la sección y el turno donde intensifica',
      path: ['targetClassSectionId'],
    })
  }
  if (!needsLocation && data.targetClassSectionId) {
    context.addIssue({
      code: 'custom',
      message: 'En los modelos 1 y 4 no se indica una sección',
      path: ['targetClassSectionId'],
    })
  }
}

export const intensificationIdParamSchema = z.object({
  id: z.uuid(),
})

export const listIntensificationsQuerySchema = z.object({
  scheduleId: z.uuid(),
  subjectId: z.uuid().optional(),
  classSectionId: z.uuid().optional(),
})

export const candidatesQuerySchema = z.object({
  scheduleId: z.uuid(),
  subjectId: z.uuid(),
  classSectionId: z.uuid().optional(),
})

// Asignar uno o varios alumnos con esa materia pendiente a un período del calendario (E3-RF-05)
export const assignIntensificationsSchema = z
  .object({
    scheduleId: z.uuid(),
    subjectId: z.uuid(),
    pendingSubjectIds: z.array(z.uuid()).min(1).max(100),
    model: z.enum(IntensificationModel),
    targetClassSectionId: z.uuid().nullable().optional(),
  })
  .superRefine(checkPlacement)

// Cambiar el modelo o la ubicación de una asignación (E3-RF-06 y 07)
export const updatePlacementSchema = z
  .object({
    model: z.enum(IntensificationModel),
    targetClassSectionId: z.uuid().nullable().optional(),
  })
  .superRefine(checkPlacement)

const optionalText = z.string().trim().max(2000).nullable().optional()

// Resultado de la intensificación (E3-RF-08).
// AA: acreditó y aprobó, con nota de 4 a 10 (obligatoria).
// CCA o CSA: sigue intensificando; la nota es opcional y, si se carga, va de 1 a 3.
export const registerResultSchema = z
  .object({
    resultCode: z.enum(IntensificationResultCode),
    score: z.number().int().min(1).max(10).nullable().optional(),
    knowledgeAtClose: optionalText, // Logros o saberes alcanzados
    pendingKnowledge: optionalText, // Saberes que le quedan pendientes (CCA o CSA)
  })
  .superRefine((data, context) => {
    const score = data.score ?? null
    if (data.resultCode === IntensificationResultCode.AA) {
      if (score === null || score < 4) {
        context.addIssue({
          code: 'custom',
          message: 'Con AA hay que cargar la nota, de 4 a 10',
          path: ['score'],
        })
      }
    } else if (score !== null && score > 3) {
      context.addIssue({
        code: 'custom',
        message: 'Con CCA o CSA la nota va de 1 a 3, o queda vacía',
        path: ['score'],
      })
    }
  })

export type ListIntensificationsQuery = z.infer<typeof listIntensificationsQuerySchema>
export type CandidatesQuery = z.infer<typeof candidatesQuerySchema>
export type AssignIntensificationsInput = z.infer<typeof assignIntensificationsSchema>
export type UpdatePlacementInput = z.infer<typeof updatePlacementSchema>
export type RegisterResultInput = z.infer<typeof registerResultSchema>