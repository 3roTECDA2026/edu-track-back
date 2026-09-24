import { StudentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.ts";
import { HttpError } from "../utils/httpError.ts";
import type { CreateEnrollmentInput, UpdateEnrollmentInput } from "../schemas/enrollment.schema.ts";

const ENROLLABLE_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL];

// POST /enrollments: enroll a student in a class section of the ACTIVE academic year.
export async function createEnrollment(input: CreateEnrollmentInput) {
  const [student, classSection] = await Promise.all([
    prisma.student.findUnique({ where: { id: input.studentId }, select: { status: true } }),
    prisma.classSection.findUnique({
      where: { id: input.classSectionId },
      select: { academicYearId: true, academicYear: { select: { active: true } } },
    }),
  ]);

  if (!student) throw new HttpError(404, "Student not found");
  if (!ENROLLABLE_STATUSES.includes(student.status)) {
    throw new HttpError(409, "Student status does not allow enrollment");
  }
  if (!classSection) throw new HttpError(404, "Class section not found");
  if (!classSection.academicYear.active) {
    throw new HttpError(409, "Enrollments are only allowed in the active academic year");
  }

  const openEnrollment = await prisma.enrollmentHistory.findFirst({
    where: {
      studentId: input.studentId,
      endDate: null,
      classSection: { academicYearId: classSection.academicYearId },
    },
    select: { id: true },
  });

  if (openEnrollment) {
    throw new HttpError(409, "Student is already enrolled in this academic year");
  }

  return prisma.enrollmentHistory.create({ data: input });
}

// PUT /enrollments/:id: change the class section of an open enrollment in the active academic year.
export async function updateEnrollment(id: string, input: UpdateEnrollmentInput) {
  const enrollment = await prisma.enrollmentHistory.findUnique({
    where: { id },
    select: {
      endDate: true,
      classSection: {
        select: { academicYearId: true, academicYear: { select: { active: true } } },
      },
    },
  });

  if (!enrollment) throw new HttpError(404, "Enrollment not found");
  if (enrollment.endDate || !enrollment.classSection.academicYear.active) {
    throw new HttpError(409, "Only the current cycle enrollment can be updated");
  }

  const target = await prisma.classSection.findUnique({
    where: { id: input.classSectionId },
    select: { academicYearId: true },
  });

  if (!target) throw new HttpError(404, "Class section not found");
  if (target.academicYearId !== enrollment.classSection.academicYearId) {
    throw new HttpError(409, "The new class section must belong to the same academic year");
  }

  return prisma.enrollmentHistory.update({
    where: { id },
    data: { classSectionId: input.classSectionId },
  });
}
