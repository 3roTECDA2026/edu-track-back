import { z } from 'zod'

// Saberes pendientes por materia (E3-RF-02, CRM-053)

// Texto libre: se recorta y, si queda vacío, se guarda como null (así se puede borrar)
const knowledgeText = z
  .string()
  .trim()
  .max(2000, 'Los saberes pueden tener hasta 2000 caracteres')
  .transform((value) => (value === '' ? null : value))

export const pendingSubjectIdParamSchema = z.object({
  id: z.guid(),
})

// Las MPAA de un alumno (todas, pendientes y acreditadas)
export const listPendingSubjectsQuerySchema = z.object({
  studentId: z.guid(),
})

// Guardar los saberes al inicio y/o al cierre del ciclo. Se manda al menos uno
export const updatePendingKnowledgeSchema = z
  .object({
    initialPendingKnowledge: knowledgeText.nullable().optional(),
    closingPendingKnowledge: knowledgeText.nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay cambios para guardar',
  })

export type ListPendingSubjectsQuery = z.infer<typeof listPendingSubjectsQuerySchema>
export type UpdatePendingKnowledgeInput = z.infer<typeof updatePendingKnowledgeSchema>
