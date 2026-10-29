import { Router } from 'express'

import attendanceRouter from '@/routes/attendance.routes'
import authRouter from '@/routes/auth.routes'
import { classSectionRouter } from '@/routes/classSection.routes'
import courseRoutes from '@/routes/course.routes'
import { enrollmentRouter } from '@/routes/enrollment.routes'
import { gradeRouter } from '@/routes/grade.routes'
import { intensificationScheduleRouter } from '@/routes/intensificationSchedule.routes'
import notificationRoutes from '@/routes/notification.routes'
import { riteRouter } from '@/routes/rite.routes'
import { studentRouter } from '@/routes/student.routes'
import { teacherAssignmentRouter } from '@/routes/teacherAssignment.routes'
import { userRouter } from '@/routes/user.routes'
import { intensificationRouter } from '@/routes/intensification.routes'

const router = Router()

router.use('/auth', authRouter)
router.use('/students', studentRouter)
router.use('/enrollments', enrollmentRouter)
router.use('/grades', gradeRouter)
router.use('/class-sections', classSectionRouter)
router.use('/teacher-assignments', teacherAssignmentRouter)
router.use('/attendance', attendanceRouter)
router.use('/notifications', notificationRoutes)
router.use('/users', userRouter)
// Las rutas de cursos se montan también en la raíz para que /api/subjects siga funcionando
router.use('/', courseRoutes)
router.use('/courses', courseRoutes)
router.use('/rites', riteRouter)
// Calendario de períodos de intensificación (CRM-055)
router.use('/intensification-schedules', intensificationScheduleRouter)
router.use('/intensifications', intensificationRouter)

export default router