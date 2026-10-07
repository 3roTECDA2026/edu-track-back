import { z } from 'zod'
import { PreliminaryAssessment, SubjectStatus } from '@prisma/client'

const scoreSchema = z
  .number()
  .int('La nota debe ser un número entero')
  .min(1, 'La nota mínima es 1')
  .max(10, 'La nota máxima es 10')

const termScoresSchema = z
  .array(scoreSchema.nullable())
  .length(4, 'Deben ser 4 notas (usá null para las vacías)')

export const gradeIdParamSchema = z.object({
  id: z.uuid(),
})

export const createGradeSchema = z.object({
  enrollmentId: z.uuid(),
  preliminaryAssessment1: z.enum(PreliminaryAssessment).optional(),
  rationale1: z.string().trim().optional(),
  term1Score: scoreSchema.optional(),
  term1Scores: termScoresSchema.optional(),
  preliminaryAssessment2: z.enum(PreliminaryAssessment).optional(),
  rationale2: z.string().trim().optional(),
  term2Score: scoreSchema.optional(),
  term2Scores: termScoresSchema.optional(),
  recoveryIn2ndTerm: z.boolean().optional(),
  finalScore: scoreSchema.optional(),
  subjectStatus: z.enum(SubjectStatus).optional(),
  term1Closed: z.boolean().optional(),
  term2Closed: z.boolean().optional(),
})

export const updateGradeSchema = createGradeSchema.omit({ enrollmentId: true }).partial()

export const listGradesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  studentId: z.uuid().optional(), // nuevo: filtrar notas por alumno
  classSectionId: z.uuid().optional(),
  subjectId: z.uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  subjectStatus: z.enum(SubjectStatus).optional(),
})

export const gradeRosterQuerySchema = z.object({
  classSectionId: z.uuid(),
  subjectId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
})

export const gradeByStudentQuerySchema = z.object({
  studentId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
})

export type CreateGradeInput = z.infer<typeof createGradeSchema>
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>
export type ListGradesQuery = z.infer<typeof listGradesQuerySchema>
export type GradeRosterQuery = z.infer<typeof gradeRosterQuerySchema>
export type GradeByStudentQuery = z.infer<typeof gradeByStudentQuerySchema>
