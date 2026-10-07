import { Router } from 'express'

import { teacherAssignmentRouter } from "@/routes/teacherAssignment.routes";
import attendanceRouter from '@/routes/attendance.routes'
import { classSectionRouter } from '@/routes/classSection.routes'
import courseRoutes from '@/routes/course.routes'
import { enrollmentRouter } from '@/routes/enrollment.routes'
import { gradeRouter } from '@/routes/grade.routes'
import notificationRoutes from '@/routes/notification.routes'
import { studentRouter } from '@/routes/student.routes'

const router = Router()

router.use('/students', studentRouter)
router.use('/enrollments', enrollmentRouter)
router.use('/grades', gradeRouter)
router.use('/class-sections', classSectionRouter)
router.use("/teacher-assignments", teacherAssignmentRouter);
router.use('/attendance', attendanceRouter)
router.use('/notifications', notificationRoutes)
router.use('/', courseRoutes)

export default router
