import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as enrollmentController from "../controllers/enrollment.controller.js";

export const enrollmentRouter = Router();

enrollmentRouter.post("/", asyncHandler(enrollmentController.createEnrollment));
enrollmentRouter.put("/:id", asyncHandler(enrollmentController.updateEnrollment));
