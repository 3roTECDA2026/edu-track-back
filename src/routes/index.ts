import { Router } from "express";
import { studentRouter } from "./student.routes.ts";
import { enrollmentRouter } from "./enrollment.routes.ts";
import { gradeRouter } from "./grade.routes.ts";
import { classSectionRouter } from "./classSection.routes.ts";
import attendanceRouter from './attendance.routes.ts';
import courseRoutes from './course.routes.ts';
import authRoutes from './auth.routes.ts';

const router = Router();

router.use("/students", studentRouter);
router.use("/enrollments", enrollmentRouter);
router.use("/grades", gradeRouter);
router.use("/class-sections", classSectionRouter);
router.use('/attendance', attendanceRouter);
router.use('/', courseRoutes);
router.use('/auth', authRoutes);


export default router;
