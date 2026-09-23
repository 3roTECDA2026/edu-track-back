import { z } from "zod";
import { PreliminaryAssessment, SubjectStatus } from "@prisma/client";

const scoreSchema = z
  .number()
  .int("La nota debe ser un número entero")
  .min(1, "La nota mínima es 1")
  .max(10, "La nota máxima es 10");

export const gradeIdParamSchema = z.object({
  id: z.uuid(),
});

export const createGradeSchema = z.object({
  enrollmentId: z.uuid(),
  preliminaryAssessment1: z.enum(PreliminaryAssessment).optional(),
  rationale1: z.string().trim().optional(),
  term1Score: scoreSchema.optional(),
  preliminaryAssessment2: z.enum(PreliminaryAssessment).optional(),
  rationale2: z.string().trim().optional(),
  term2Score: scoreSchema.optional(),
  recoveryIn2ndTerm: z.boolean().optional(),
  finalScore: scoreSchema.optional(),
  subjectStatus: z.enum(SubjectStatus).optional(),
  term1Closed: z.boolean().optional(),
  term2Closed: z.boolean().optional(),
});

export const updateGradeSchema = createGradeSchema.omit({ enrollmentId: true }).partial();

export const listGradesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  classSectionId: z.uuid().optional(),
  subjectId: z.uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  subjectStatus: z.enum(SubjectStatus).optional(),
});

export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type ListGradesQuery = z.infer<typeof listGradesQuerySchema>;
