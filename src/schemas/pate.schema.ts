import { IntensificationModel, PateStatus } from '@prisma/client'
import { z } from 'zod'

import { checkPlacement } from '@/schemas/intensification.schema'

// PATE (E4-RF-06, CRM-078)

// Máximo de materias a intensificar por PATE: el resto se recursa (Res. 1650/24, A5, inc. 13)
export const MAX_SUBJECTS_TO_INTENSIFY = 4

const requiredText = (label: string) =>
  z.string().trim().min(1, `Completá ${label}`).max(5000, 'Máximo 5000 caracteres')

export const pateIdParamSchema = z.object({
  id: z.guid(),
})

export const listPatesQuerySchema = z.object({
  studentId: z.guid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(PateStatus).optional(),
})

// Datos para armar el formulario: el alumno y, si la hay, la reunión del EDTE donde se trata
export const pateOptionsQuerySchema = z.object({
  studentId: z.guid(),
  edteMeetingId: z.guid().optional(),
})

// MPAA a intensificar: modelo y, en los modelos 2 y 3, la sección donde intensifica
const subjectToIntensifySchema = z
  .object({
    pendingSubjectId: z.guid(),
    model: z.enum(IntensificationModel),
    targetClassSectionId: z.guid().nullable().optional(),
  })
  .superRefine(checkPlacement)

// MPAA a recursar: la sección donde la cursa (año, sección y turno)
const subjectToRepeatSchema = z.object({
  pendingSubjectId: z.guid(),
  classSectionId: z.guid(),
})

const subjectsToIntensifySchema = z
  .array(subjectToIntensifySchema)
  .max(
    MAX_SUBJECTS_TO_INTENSIFY,
    `Se pueden intensificar hasta ${MAX_SUBJECTS_TO_INTENSIFY} materias; el resto se recursa`
  )
const subjectsToRepeatSchema = z.array(subjectToRepeatSchema).max(12)

// Cada MPAA va una sola vez: no se repite ni está en las dos listas
function checkSubjectsOnce(
  data: {
    subjectsToIntensify?: { pendingSubjectId: string }[]
    subjectsToRepeat?: { pendingSubjectId: string }[]
  },
  context: z.RefinementCtx
) {
  const ids = [
    ...(data.subjectsToIntensify ?? []).map((item) => item.pendingSubjectId),
    ...(data.subjectsToRepeat ?? []).map((item) => item.pendingSubjectId),
  ]
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: 'custom',
      message: 'Cada materia va una sola vez: no puede repetirse ni estar en las dos listas',
      path: ['subjectsToRepeat'],
    })
  }
}

export const createPateSchema = z
  .object({
    studentId: z.guid(),
    // Opcional hasta que se puedan registrar reuniones del EDTE (CRM-075)
    edteMeetingId: z.guid().nullable().optional(),
    diagnosis: requiredText('el diagnóstico'),
    supportStrategies: requiredText('las estrategias de acompañamiento'),
    schedule: z.string().trim().max(5000).nullable().optional(),
    subjectsToIntensify: subjectsToIntensifySchema.default([]),
    subjectsToRepeat: subjectsToRepeatSchema.default([]),
  })
  .superRefine(checkSubjectsOnce)

// Edición (solo en borrador): las listas que vienen reemplazan a las anteriores
export const updatePateSchema = z
  .object({
    diagnosis: requiredText('el diagnóstico').optional(),
    supportStrategies: requiredText('las estrategias de acompañamiento').optional(),
    schedule: z.string().trim().max(5000).nullable().optional(),
    subjectsToIntensify: subjectsToIntensifySchema.optional(),
    subjectsToRepeat: subjectsToRepeatSchema.optional(),
  })
  .superRefine(checkSubjectsOnce)
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay cambios para guardar',
  })

// Confirmar (pasa a en curso) o cerrar
export const changePateStatusSchema = z.object({
  status: z.enum([PateStatus.IN_PROGRESS, PateStatus.CLOSED]),
})

export type ListPatesQuery = z.infer<typeof listPatesQuerySchema>
export type PateOptionsQuery = z.infer<typeof pateOptionsQuerySchema>
export type CreatePateInput = z.infer<typeof createPateSchema>
export type UpdatePateInput = z.infer<typeof updatePateSchema>
export type PateSubjectToIntensify = z.infer<typeof subjectToIntensifySchema>
export type PateSubjectToRepeat = z.infer<typeof subjectToRepeatSchema>
