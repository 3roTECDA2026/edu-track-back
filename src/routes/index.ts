import { Router } from "express";
import { studentRouter } from "./student.routes.ts";
import { enrollmentRouter } from "./enrollment.routes.ts";
import { gradeRouter } from "./grade.routes.ts";
import { classSectionRouter } from "./classSection.routes.ts";
import { teacherAssignmentRouter } from "./teacherAssignment.routes.ts";
import attendanceRouter from './attendance.routes.ts';
import courseRoutes from './course.routes.ts';

const router = Router();

router.use("/students", studentRouter);
router.use("/enrollments", enrollmentRouter);
router.use("/grades", gradeRouter);
router.use("/class-sections", classSectionRouter);
router.use("/teacher-assignments", teacherAssignmentRouter);
router.use('/attendance', attendanceRouter);
router.use('/', courseRoutes);

export default router;
