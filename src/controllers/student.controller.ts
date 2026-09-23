import type { Request, Response } from "express";
import * as studentService from "../services/student.service.js";
import { listStudentsQuerySchema, studentIdParamSchema } from "../schemas/student.schema.js";
import { createStudentSchema } from "../schemas/student.schema.js";

export async function listStudents(req: Request, res: Response) {
  const query = listStudentsQuerySchema.parse(req.query);
  res.json(await studentService.listStudents(query));
}

export async function deactivateStudent(req: Request, res: Response) {
  const { id } = studentIdParamSchema.parse(req.params);
  res.json(await studentService.deactivateStudent(id));
}

export async function getStudentHistory(req: Request, res: Response) {
  const { id } = studentIdParamSchema.parse(req.params);
  res.json(await studentService.getStudentHistory(id));
}

export async function createStudent(req: Request, res: Response) {
  const data = createStudentSchema.parse(req.body);
  res.status(201).json(await studentService.createStudent(data));
}

export async function getStudent(req: Request, res: Response) {
  const { id } = studentIdParamSchema.parse(req.params);
  res.json(await studentService.getStudent(id));
}