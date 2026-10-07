import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as teacherAssignmentController from "../controllers/teacherAssignment.controller";

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