import type { Request, Response } from "express";
import * as gradeService from "../services/grade.service.js";
import {
  createGradeSchema,
  updateGradeSchema,
  listGradesQuerySchema,
  gradeIdParamSchema,
} from "../schemas/grade.schema.js";


export async function listGrades(req: Request, res: Response) {
  const query = listGradesQuerySchema.parse(req.query);
  res.json(await gradeService.listGrades(query));
}

export async function createGrade(req: Request, res: Response) {
  const input = createGradeSchema.parse(req.body);
  res.status(201).json(await gradeService.upsertGrade(input));
}

export async function updateGrade(req: Request, res: Response) {
  const { id } = gradeIdParamSchema.parse(req.params);
  const input = updateGradeSchema.parse(req.body);
  res.json(await gradeService.updateGrade(id, input));
}

export async function deleteGrade(req: Request, res: Response) {
  const { id } = gradeIdParamSchema.parse(req.params);
  await gradeService.deleteGrade(id);
  res.status(204).send();
}
