import { prisma } from "../lib/prisma.ts";
import type { ListClassSectionsQuery } from "../schemas/classSection.schema.ts";

export async function listClassSections(query: ListClassSectionsQuery) {
  return prisma.classSection.findMany({
    where: {
      academicYear: query.year !== undefined ? { year: query.year } : { active: true },
    },
    orderBy: [{ grade: "asc" }, { division: "asc" }, { shift: "asc" }],
    select: {
      id: true,
      grade: true,
      division: true,
      shift: true,
      academicYear: { select: { year: true } },
    },
  });
}