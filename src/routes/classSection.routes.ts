import { Router } from "express";
import * as classSectionController from "@/controllers/classSection.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export const classSectionRouter = Router();

classSectionRouter.get("/", asyncHandler(classSectionController.listClassSections));