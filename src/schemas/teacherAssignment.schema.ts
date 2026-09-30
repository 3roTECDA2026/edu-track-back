import { z } from "zod";

// --- TeacherSubjectCourse: asignación de una materia a un docente en un curso/división ---

export const createTeacherAssignmentSchema = z.object({
  teacherId: z.string().uuid(),
  subjectId: z.string().uuid(),
  classSectionId: z.string().uuid(),
});

// La terna (docente, materia, curso) es la clave única de la asignación: cambiarla
// equivale a dar de baja una asignación y crear otra.
export const updateTeacherAssignmentSchema = createTeacherAssignmentSchema.partial();

export const teacherAssignmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listTeacherAssignmentsQuerySchema = z.object({
  teacherId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  classSectionId: z.string().uuid().optional(),
});

export type CreateTeacherAssignmentInput = z.infer<typeof createTeacherAssignmentSchema>;
export type UpdateTeacherAssignmentInput = z.infer<typeof updateTeacherAssignmentSchema>;
export type ListTeacherAssignmentsQuery = z.infer<typeof listTeacherAssignmentsQuerySchema>;