import { z } from 'zod'
import { Shift, Orientation } from '@prisma/client'

// Schema para Cursos / Divisiones (ClassSection)
export const createClassSectionSchema = z.object({
  grade: z.number().int().min(1).max(7),
  division: z.string().min(1),
  shift: z.nativeEnum(Shift),
  orientation: z.nativeEnum(Orientation).optional().nullable(),
  academicYearId: z.string().uuid(),
})

export const updateClassSectionSchema = createClassSectionSchema.partial()

// Schema para Materias (Subject)
export const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  hoursPerWeek: z.number().int().positive(),
  gradeLevel: z.number().int().min(1).max(7),
  area: z.string().min(1),
})

export const updateSubjectSchema = createSubjectSchema.partial()
