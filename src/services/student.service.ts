import { StudentStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/httpError.js";
import type { ListStudentsQuery } from "../schemas/student.schema.js";

// Statuses shown in operational listings when no status filter is sent.
const OPERATIONAL_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL];

const classSectionSummarySelect = {
  grade: true,
  division: true,
  shift: true,
  academicYear: { select: { year: true } },
} satisfies Prisma.ClassSectionSelect;

const studentListSelect = {
  id: true,
  dni: true,
  firstName: true,
  lastName: true,
  recordNumber: true,
  status: true,
  enrollmentHistory: {
    where: { endDate: null },
    orderBy: { startDate: "desc" },
    take: 1,
    select: { classSection: { select: classSectionSummarySelect } },
  },
} satisfies Prisma.StudentSelect;

function buildStudentWhere(query: ListStudentsQuery): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {};

  if (query.status === undefined) {
    where.status = { in: OPERATIONAL_STATUSES };
  } else if (query.status !== "all") {
    where.status = query.status;
  }

  // Each word must match first name, last name or DNI ("juan perez" works).
  if (query.search) {
    const terms = query.search.split(/\s+/);
    where.AND = terms.map(
      (term): Prisma.StudentWhereInput => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { dni: { contains: term } },
        ],
      }),
    );
  }

  // Section filters are combined so they match the SAME enrollment record.
  // Without "year", they apply to the current (open) enrollment in the active academic year.
  const hasSectionFilter =
    query.year !== undefined || query.grade !== undefined || query.division || query.shift;

  if (hasSectionFilter) {
    where.enrollmentHistory = {
      some: {
        ...(query.year === undefined ? { endDate: null } : {}),
        classSection: {
          academicYear: query.year !== undefined ? { year: query.year } : { active: true },
          ...(query.grade !== undefined ? { grade: query.grade } : {}),
          ...(query.division ? { division: query.division } : {}),
          ...(query.shift ? { shift: query.shift } : {}),
        },
      },
    };
  }

  return where;
}

export async function listStudents(query: ListStudentsQuery) {
  const where = buildStudentWhere(query);

  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: studentListSelect,
    }),
    prisma.student.count({ where }),
  ]);

  const data = students.map(({ enrollmentHistory, ...student }) => {
    const section = enrollmentHistory[0]?.classSection;
    return {
      ...student,
      currentSection: section
        ? {
            year: section.academicYear.year,
            grade: section.grade,
            division: section.division,
            shift: section.shift,
          }
        : null,
    };
  });

  return {
    data,
    total,
    page: query.page,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function deactivateStudent(id: string) {
  const student = await prisma.student.findUnique({ where: { id }, select: { status: true } });

  if (!student) throw new HttpError(404, "Student not found");
  if (student.status === StudentStatus.INACTIVE) {
    throw new HttpError(409, "Student is already inactive");
  }

  return prisma.student.update({
    where: { id },
    data: { status: StudentStatus.INACTIVE },
    select: { id: true, firstName: true, lastName: true, status: true },
  });
}

export async function getStudentHistory(id: string) {
  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) throw new HttpError(404, "Student not found");

  const records = await prisma.enrollmentHistory.findMany({
    where: { studentId: id },
    orderBy: [{ classSection: { academicYear: { year: "desc" } } }, { startDate: "desc" }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      leaveReason: true,
      classSection: { select: classSectionSummarySelect },
    },
  });

  return records.map(({ classSection, ...record }) => ({
    id: record.id,
    year: classSection.academicYear.year,
    grade: classSection.grade,
    division: classSection.division,
    section: `${classSection.grade}° ${classSection.division}`,
    shift: classSection.shift,
    startDate: record.startDate,
    endDate: record.endDate,
    leaveReason: record.leaveReason,
  }));
}
