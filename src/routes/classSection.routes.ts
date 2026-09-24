import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";
import * as classSectionController from "../controllers/classSection.controller.ts";

export const classSectionRouter = Router();

classSectionRouter.get("/", asyncHandler(classSectionController.listClassSections));