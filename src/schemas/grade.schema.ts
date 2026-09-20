import { z } from 'zod'

// ── Piezas reutilizables ──────────────────────────────────────────────
// Nota numérica: entero de 1 a 10
const scoreSchema = z
  .number('La nota debe ser un número')
  .int('La nota debe ser un número entero')
  .min(1, 'La nota mínima es 1')
  .max(10, 'La nota máxima es 10')

// Valoración preliminar de la trayectoria (TEA / TEP / TED)
const preliminaryAssessmentSchema = z.enum(['TEA', 'TEP', 'TED'])

// Estado de acreditación de la materia
const subjectStatusSchema = z.enum([
  'IN_PROGRESS',
  'APPROVED_ACCREDITED',
  'PENDING_1ST_TERM',
  'PENDING_2ND_TERM',
  'IN_INTENSIFICATION',
  'CONTINUES_INTENSIFYING',
  'MPAA',
])

// ── POST /api/grades ──────────────────────────────────────────────────
// Crea (o actualiza, por inscripción) la calificación de un alumno en una materia.
// La calificación cuelga de la inscripción (enrollment), por eso pide enrollmentId.
export const createGradeSchema = z.object({
  enrollmentId: z.uuid('El enrollmentId debe ser un UUID válido'),
  // 1° cuatrimestre
  preliminaryAssessment1: preliminaryAssessmentSchema.optional(),
  rationale1: z.string().optional(),
  term1Score: scoreSchema.optional(),
  // 2° cuatrimestre
  preliminaryAssessment2: preliminaryAssessmentSchema.optional(),
  rationale2: z.string().optional(),
  term2Score: scoreSchema.optional(),
  recoveryIn2ndTerm: z.boolean().optional(),
  // Cierre / final
  finalScore: scoreSchema.optional(),
  subjectStatus: subjectStatusSchema.optional(),
  term1Closed: z.boolean().optional(),
  term2Closed: z.boolean().optional(),
})

// ── PUT /api/grades/:id ───────────────────────────────────────────────
// Actualiza una calificación existente. No se puede cambiar la inscripción,
// y todos los campos son opcionales (se manda solo lo que se quiere modificar).
export const updateGradeSchema = createGradeSchema.omit({ enrollmentId: true }).partial()

// ── GET /api/grades ───────────────────────────────────────────────────
// Filtros + paginado. page/pageSize hacen que la cantidad de resultados sea variable.
// Los query params llegan como texto, por eso se usa z.coerce para convertir a número.
export const listGradesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  classSectionId: z.uuid().optional(), // división / curso
  subjectId: z.uuid().optional(),      // materia
  year: z.coerce.number().int().optional(), // año lectivo (ej: 2026)
  subjectStatus: subjectStatusSchema.optional(),
})

export type CreateGradeInput = z.infer<typeof createGradeSchema>
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>
export type ListGradesQuery = z.infer<typeof listGradesQuerySchema>
