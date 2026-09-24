import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";
import * as gradeController from "../controllers/grade.controller.ts";

export const gradeRouter = Router();

gradeRouter.get("/", asyncHandler(gradeController.listGrades));
gradeRouter.post("/", asyncHandler(gradeController.createGrade));
gradeRouter.put("/:id", asyncHandler(gradeController.updateGrade));
gradeRouter.delete("/:id", asyncHandler(gradeController.deleteGrade));
