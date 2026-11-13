import { z } from 'zod'

// Recursado de materias (CRM-082). IDs con z.guid(): acepta los ids fijos del seed.

export const subjectRepeatIdParamSchema = z.object({
  id: z.guid(),
})

// Se recursa una MPAA: la materia, el alumno y el año de origen salen de ella
export const createSubjectRepeatSchema = z
  .object({
    pendingSubjectId: z.guid(),
    classSectionId: z.guid(),
  })
  .strict()

export type CreateSubjectRepeatInput = z.infer<typeof createSubjectRepeatSchema>

// Al editar solo cambia la sección: las notas y la asistencia cuelgan de la inscripción
export const updateSubjectRepeatSchema = z
  .object({
    classSectionId: z.guid(),
  })
  .strict()

export type UpdateSubjectRepeatInput = z.infer<typeof updateSubjectRepeatSchema>

export const listSubjectRepeatsQuerySchema = z.object({
  studentId: z.guid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export type ListSubjectRepeatsQuery = z.infer<typeof listSubjectRepeatsQuerySchema>

export const repeatOptionsQuerySchema = z.object({
  studentId: z.guid(),
})

export type RepeatOptionsQuery = z.infer<typeof repeatOptionsQuerySchema>
