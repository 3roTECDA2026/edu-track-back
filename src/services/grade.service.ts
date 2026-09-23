import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/httpError.js";
import type {
  CreateGradeInput,
  UpdateGradeInput,
  ListGradesQuery,
} from "../schemas/grade.schema.js";

const gradeListInclude = {
  enrollment: {
    select: {
      id: true,
      student: { select: { id: true, dni: true, lastName: true, firstName: true } },
      subject: { select: { id: true, name: true } },
      classSection: { select: { id: true, grade: true, division: true } },
      academicYear: { select: { id: true, year: true } },
    },
  },
} satisfies Prisma.GradeInclude;


function buildGradeWhere(query: ListGradesQuery): Prisma.GradeWhereInput {
  const where: Prisma.GradeWhereInput = {};
  const enrollment: Prisma.EnrollmentWhereInput = {};

  if (query.classSectionId) enrollment.classSectionId = query.classSectionId;
  if (query.subjectId) enrollment.subjectId = query.subjectId;
  if (query.year !== undefined) enrollment.academicYear = { year: query.year };

  if (Object.keys(enrollment).length > 0) where.enrollment = enrollment;
  if (query.subjectStatus) where.subjectStatus = query.subjectStatus;

  return where;
}

export async function listGrades(query: ListGradesQuery) {
  const where = buildGradeWhere(query);

  const [data, total] = await prisma.$transaction([
    prisma.grade.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: gradeListInclude,
    }),
    prisma.grade.count({ where }),
  ]);

  return {
    data,
    total,
    page: query.page,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function upsertGrade(input: CreateGradeInput) {
  const { enrollmentId, ...scores } = input;

  // TODO (auth): validar que el docente autenticado tenga asignada esta materia
  // (TeacherSubjectCourse) cuando el login esté integrado.
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true },
  });
  if (!enrollment) throw new HttpError(404, "Enrollment not found");

  return prisma.grade.upsert({
    where: { enrollmentId },
    update: scores as Prisma.GradeUpdateInput,
    create: { enrollmentId, ...scores } as Prisma.GradeUncheckedCreateInput,
  });
}


export async function updateGrade(id: string, input: UpdateGradeInput) {
  const grade = await prisma.grade.findUnique({ where: { id }, select: { id: true } });
  if (!grade) throw new HttpError(404, "Grade not found");

  return prisma.grade.update({
    where: { id },
    data: input as Prisma.GradeUpdateInput,
  });
}

export async function deleteGrade(id: string) {
  const grade = await prisma.grade.findUnique({ where: { id }, select: { id: true } });
  if (!grade) throw new HttpError(404, "Grade not found");

  await prisma.grade.delete({ where: { id } });
}
