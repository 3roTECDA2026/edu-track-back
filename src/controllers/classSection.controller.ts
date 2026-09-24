import type { Request, Response } from "express";
import * as classSectionService from "../services/classSection.service.ts";
import { listClassSectionsQuerySchema } from "../schemas/classSection.schema.ts";

export async function listClassSections(req: Request, res: Response) {
  const query = listClassSectionsQuerySchema.parse(req.query);
  const sections = await classSectionService.listClassSections(query);

  res.json(
    sections.map((s) => ({
      id: s.id,
      year: s.academicYear.year,
      grade: s.grade,
      division: s.division,
      shift: s.shift,
    })),
  );
}