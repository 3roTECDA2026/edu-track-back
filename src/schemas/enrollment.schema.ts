import { z } from "zod";

export const enrollmentIdParamSchema = z.object({
  id: z.uuid(),
});

export const createEnrollmentSchema = z.object({
  studentId: z.uuid(),
  classSectionId: z.uuid(),
});

export const updateEnrollmentSchema = z.object({
  classSectionId: z.uuid(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
