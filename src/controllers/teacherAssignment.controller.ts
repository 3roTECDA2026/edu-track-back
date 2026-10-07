import type { Request, Response } from "express";
import * as teacherAssignmentService from "../services/teacherAssignment.service";
import {
  createTeacherAssignmentSchema,
  listTeacherAssignmentsQuerySchema,
  teacherAssignmentIdParamSchema,
  updateTeacherAssignmentSchema,
} from "../schemas/teacherAssignment.schema";

export async function listTeacherAssignments(req: Request, res: Response) {
  const query = listTeacherAssignmentsQuerySchema.parse(req.query);
  res.json(await teacherAssignmentService.listTeacherAssignments(query));
}

export async function getTeacherAssignment(req: Request, res: Response) {
  const { id } = teacherAssignmentIdParamSchema.parse(req.params);
  res.json(await teacherAssignmentService.getTeacherAssignment(id));
}

export async function createTeacherAssignment(req: Request, res: Response) {
  const data = createTeacherAssignmentSchema.parse(req.body);
  res.status(201).json(await teacherAssignmentService.createTeacherAssignment(data));
}

export async function updateTeacherAssignment(req: Request, res: Response) {
  const { id } = teacherAssignmentIdParamSchema.parse(req.params);
  const data = updateTeacherAssignmentSchema.parse(req.body);
  res.json(await teacherAssignmentService.updateTeacherAssignment(id, data));
}

export async function deleteTeacherAssignment(req: Request, res: Response) {
  const { id } = teacherAssignmentIdParamSchema.parse(req.params);
  await teacherAssignmentService.deleteTeacherAssignment(id);
  res.status(204).send();
}