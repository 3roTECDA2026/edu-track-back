import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as studentController from "../controllers/student.controller.js";

export const studentRouter = Router();

studentRouter.get("/", asyncHandler(studentController.listStudents));
studentRouter.patch("/:id/deactivate", asyncHandler(studentController.deactivateStudent));
studentRouter.get("/:id/history", asyncHandler(studentController.getStudentHistory));
