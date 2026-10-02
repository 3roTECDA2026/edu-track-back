import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";
import * as teacherAssignmentController from "../controllers/teacherAssignment.controller.ts";

export const teacherAssignmentRouter = Router();

teacherAssignmentRouter.get(
  "/",
  asyncHandler(teacherAssignmentController.listTeacherAssignments),
);
teacherAssignmentRouter.post(
  "/",
  asyncHandler(teacherAssignmentController.createTeacherAssignment),
);
teacherAssignmentRouter.get(
  "/:id",
  asyncHandler(teacherAssignmentController.getTeacherAssignment),
);
teacherAssignmentRouter.patch(
  "/:id",
  asyncHandler(teacherAssignmentController.updateTeacherAssignment),
);
teacherAssignmentRouter.delete(
  "/:id",
  asyncHandler(teacherAssignmentController.deleteTeacherAssignment),
);