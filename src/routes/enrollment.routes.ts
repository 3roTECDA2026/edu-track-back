import { Router } from "express";
import * as enrollmentController from "@/controllers/enrollment.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export const enrollmentRouter = Router();

enrollmentRouter.post("/", asyncHandler(enrollmentController.createEnrollment));
enrollmentRouter.put("/:id", asyncHandler(enrollmentController.updateEnrollment));
