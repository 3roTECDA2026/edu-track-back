import { StudentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.ts";
import { HttpError } from "../utils/httpError.ts";
import type { ListStudentsQuery, CreateStudentInput } from "../schemas/student.schema.ts";

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

const MAX_RECORD_NUMBER_ATTEMPTS = 5;

const studentDetailSelect = {
  id: true,
  dni: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  placeOfBirth: true,
  address: true,
  city: true,
  phone: true,
  recordNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  guardians: {
    select: {
      isPrimary: true,
      guardian: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, dni: true, relationship: true } },
    },
  },
  enrollmentHistory: {
    where: { endDate: null },
    orderBy: { startDate: "desc" },
    take: 1,
    select: { classSection: { select: classSectionSummarySelect } },
  },
} satisfies Prisma.StudentSelect;

function splitGuardianName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    const only = parts[0] ?? fullName.trim();
    return { firstName: only, lastName: only };
  }

  const lastName = parts.pop()!; // ya sabemos que hay al menos 2 elementos
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

async function buildStudentResponse(client: Prisma.TransactionClient | typeof prisma, id: string) {
  const student = await client.student.findUnique({ where: { id }, select: studentDetailSelect });
  if (!student) throw new HttpError(404, "Student not found");

  const { enrollmentHistory, guardians, ...rest } = student;
  const section = enrollmentHistory[0]?.classSection;

  return {
    ...rest,
    currentSection: section
      ? { year: section.academicYear.year, grade: section.grade, division: section.division, shift: section.shift }
      : null,
    guardians: guardians.map((g) => ({ ...g.guardian, isPrimary: g.isPrimary })),
  };
}

export async function getStudent(id: string) {
  return buildStudentResponse(prisma, id);
}

export async function createStudent(input: CreateStudentInput) {
  const classSection = await prisma.classSection.findUnique({
    where: { id: input.classSectionId },
    select: { id: true, academicYear: { select: { year: true } } },
  });
  if (!classSection) throw new HttpError(404, "Class section not found");

  const { firstName: guardianFirstName, lastName: guardianLastName } = splitGuardianName(input.guardianName);
  const year = classSection.academicYear.year;

  for (let attempt = 0; attempt < MAX_RECORD_NUMBER_ATTEMPTS; attempt++) {
    const count = await prisma.student.count({ where: { recordNumber: { startsWith: `${year}-` } } });
    const recordNumber = `${year}-${String(count + 1).padStart(4, "0")}`;

    try {
      const studentId = await prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            dni: input.dni,
            dateOfBirth: input.dateOfBirth,
            placeOfBirth: input.placeOfBirth,
            address: input.address,
            city: input.city,
            phone: input.phone,
            recordNumber,
          },
        });

        const guardian = await tx.guardian.create({
          data: {
            firstName: guardianFirstName,
            lastName: guardianLastName,
            phone: input.guardianPhone,
            email: input.guardianEmail,
            dni: input.guardianDni ?? null,
            relationship: input.guardianRelationship ?? null,
          } ,
        });

        await tx.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.id, isPrimary: true } });
        await tx.enrollmentHistory.create({ data: { studentId: student.id, classSectionId: classSection.id } });

        return student.id;
      });

      return buildStudentResponse(prisma, studentId);
    } catch (err) {
      const isRecordNumberConflict =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("recordNumber");

      if (isRecordNumberConflict && attempt < MAX_RECORD_NUMBER_ATTEMPTS - 1) continue; // reintenta con otro correlativo
      throw err; // DNI duplicado (P2002 en dni) sube al errorHandler global -> 409
    }
  }

  throw new HttpError(500, "No se pudo generar un número de legajo único");
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

