import { Router } from "express";
import * as studentController from "@/controllers/student.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export const studentRouter = Router();

studentRouter.get("/", asyncHandler(studentController.listStudents));
studentRouter.patch("/:id/deactivate", asyncHandler(studentController.deactivateStudent));
studentRouter.post("/", asyncHandler(studentController.createStudent));
studentRouter.get("/:id", asyncHandler(studentController.getStudent));
studentRouter.get("/:id/history", asyncHandler(studentController.getStudentHistory));
