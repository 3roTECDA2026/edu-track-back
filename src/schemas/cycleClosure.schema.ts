import { z } from 'zod'

// z.guid() acepta también los ids fijos del seed (00000000-...), que z.uuid() rechaza en Zod 4
export const academicYearIdParamSchema = z.object({
  academicYearId: z.guid(),
})

export type AcademicYearIdParam = z.infer<typeof academicYearIdParamSchema>
