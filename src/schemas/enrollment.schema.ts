import { z } from 'zod'

export const enrollmentIdParamSchema = z.object({
  id: z.guid(),
})

export const createEnrollmentSchema = z.object({
  studentId: z.guid(),
  classSectionId: z.guid(),
})

export const updateEnrollmentSchema = z.object({
  classSectionId: z.guid(),
})

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>
