import type { Request, Response } from "express";
import * as enrollmentService from "../services/enrollment.service.ts";
import {
  createEnrollmentSchema,
  enrollmentIdParamSchema,
  updateEnrollmentSchema,
} from "../schemas/enrollment.schema.ts";

export async function createEnrollment(req: Request, res: Response) {
  const input = createEnrollmentSchema.parse(req.body);
  res.status(201).json(await enrollmentService.createEnrollment(input));
}

export async function updateEnrollment(req: Request, res: Response) {
  const { id } = enrollmentIdParamSchema.parse(req.params);
  const input = updateEnrollmentSchema.parse(req.body);
  res.json(await enrollmentService.updateEnrollment(id, input));
}
