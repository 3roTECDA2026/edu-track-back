import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import type {
  CreateTeacherAssignmentInput,
  ListTeacherAssignmentsQuery,
  UpdateTeacherAssignmentInput,
} from "../schemas/teacherAssignment.schema.ts";

// Proyección de lectura: la asignación siempre viaja con la ficha del docente,
// la materia y el curso para que el frontend no necesite llamadas extra.
const teacherSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

const subjectSummarySelect = {
  id: true,
  name: true,
  code: true,
  hoursPerWeek: true,
  area: true,
} satisfies Prisma.SubjectSelect;

const classSectionSummarySelect = {
  id: true,
  grade: true,
  division: true,
  shift: true,
  academicYear: { select: { id: true, year: true } },
} satisfies Prisma.ClassSectionSelect;

const teacherAssignmentSelect = {
  id: true,
  createdAt: true,
  teacherId: true,
  subjectId: true,
  classSectionId: true,
  teacher: { select: teacherSummarySelect },
  subject: { select: subjectSummarySelect },
  classSection: { select: classSectionSummarySelect },
} satisfies Prisma.TeacherSubjectCourseSelect;

function buildAssignmentWhere(
  query: ListTeacherAssignmentsQuery,
): Prisma.TeacherSubjectCourseWhereInput {
  const where: Prisma.TeacherSubjectCourseWhereInput = {};

  if (query.teacherId !== undefined) where.teacherId = query.teacherId;
  if (query.subjectId !== undefined) where.subjectId = query.subjectId;
  if (query.classSectionId !== undefined) where.classSectionId = query.classSectionId;

  return where;
}

export async function listTeacherAssignments(query: ListTeacherAssignmentsQuery) {
  return await prisma.teacherSubjectCourse.findMany({
    where: buildAssignmentWhere(query),
    select: teacherAssignmentSelect,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getTeacherAssignment(id: string) {
  const assignment = await prisma.teacherSubjectCourse.findUnique({
    where: { id },
    select: teacherAssignmentSelect,
  });

  if (!assignment) throw new HttpError(404, "Teacher assignment not found");

  return assignment;
}

// Un docente puede dictar la misma materia en varias divisiones y varias materias
// por ciclo, pero sólo una vez cada combinación (lo garantiza el @@unique del schema).
export async function createTeacherAssignment(data: CreateTeacherAssignmentInput) {
  await assertTeacherIsAssignable(data.teacherId);

  return await prisma.teacherSubjectCourse.create({
    data,
    select: teacherAssignmentSelect,
  });
}

export async function updateTeacherAssignment(id: string, data: UpdateTeacherAssignmentInput) {
  await getTeacherAssignment(id);

  if (data.teacherId !== undefined) {
    await assertTeacherIsAssignable(data.teacherId);
  }

  // El tsconfig usa exactOptionalPropertyTypes, que no admite claves presentes con
  // valor undefined: se descartan para no enviar nulls a Prisma.
  const changes: Prisma.TeacherSubjectCourseUncheckedUpdateInput = {};
  if (data.teacherId !== undefined) changes.teacherId = data.teacherId;
  if (data.subjectId !== undefined) changes.subjectId = data.subjectId;
  if (data.classSectionId !== undefined) changes.classSectionId = data.classSectionId;

  return await prisma.teacherSubjectCourse.update({
    where: { id },
    data: changes,
    select: teacherAssignmentSelect,
  });
}

export async function deleteTeacherAssignment(id: string) {
  await getTeacherAssignment(id);

  await prisma.teacherSubjectCourse.delete({ where: { id } });
}

// Verifica que el usuario exista y tenga rol TEACHER antes de asignarle una materia.
// Las FK inexistentes las traduce el errorHandler global a 409, pero el rol incorrecto
// es una regla de negocio que conviene rechazar explícitamente.
async function assertTeacherIsAssignable(teacherId: string): Promise<void> {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, role: true, status: true },
  });

  if (!teacher) throw new HttpError(404, "Teacher not found");
  if (teacher.role !== Role.TEACHER) {
    throw new HttpError(409, `El usuario ${teacherId} no tiene rol docente`);
  }
}