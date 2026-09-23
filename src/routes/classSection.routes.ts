import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as classSectionController from "../controllers/classSection.controller.js";

export const classSectionRouter = Router();

classSectionRouter.get("/", asyncHandler(classSectionController.listClassSections));