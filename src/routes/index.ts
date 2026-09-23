import { Router } from "express";
import { studentRouter } from "./student.routes.js";
import { enrollmentRouter } from "./enrollment.routes.js";
import { gradeRouter } from "./grade.routes.js";
import { classSectionRouter } from "./classSection.routes.js";

const router = Router();

router.use("/students", studentRouter);
router.use("/enrollments", enrollmentRouter);
router.use("/grades", gradeRouter);
router.use("/class-sections", classSectionRouter);

export default router;
