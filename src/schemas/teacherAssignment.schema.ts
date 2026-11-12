import { z } from 'zod'

// --- TeacherSubjectCourse: asignación de una materia a un docente en un curso/división ---

export const createTeacherAssignmentSchema = z.object({
  teacherId: z.guid(),
  subjectId: z.guid(),
  classSectionId: z.guid(),
})

// La terna (docente, materia, curso) es la clave única de la asignación: cambiarla
// equivale a dar de baja una asignación y crear otra.
export const updateTeacherAssignmentSchema = createTeacherAssignmentSchema.partial()

export const teacherAssignmentIdParamSchema = z.object({
  id: z.guid(),
})

export const listTeacherAssignmentsQuerySchema = z.object({
  teacherId: z.guid().optional(),
  subjectId: z.guid().optional(),
  classSectionId: z.guid().optional(),
})

export type CreateTeacherAssignmentInput = z.infer<typeof createTeacherAssignmentSchema>
export type UpdateTeacherAssignmentInput = z.infer<typeof updateTeacherAssignmentSchema>
export type ListTeacherAssignmentsQuery = z.infer<typeof listTeacherAssignmentsQuerySchema>
