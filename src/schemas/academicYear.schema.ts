import { z } from 'zod'

export const createAcademicYearSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  active: z.boolean().optional().default(false),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  term1StartDate: z.coerce.date().optional(),
  term1EndDate: z.coerce.date().optional(),
  term2StartDate: z.coerce.date().optional(),
  term2EndDate: z.coerce.date().optional(),
})

export const createCycleSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  isActive: z.boolean().optional().default(false),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})

export const updateAcademicYearSchema = createAcademicYearSchema.partial()

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>
