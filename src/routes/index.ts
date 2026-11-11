import { Router } from 'express'

import attendanceRouter from '@/routes/attendance.routes'
import authRouter from '@/routes/auth.routes'
import { classSectionRouter } from '@/routes/classSection.routes'
import courseRoutes from '@/routes/course.routes'
import { cycleClosureRouter } from '@/routes/cycleClosure.routes'
import { enrollmentRouter } from '@/routes/enrollment.routes'
import { gradeRouter } from '@/routes/grade.routes'
import { institutionalConfigRouter } from '@/routes/institutionalConfig.routes'
import { intensificationScheduleRouter } from '@/routes/intensificationSchedule.routes'
import { intensificationRouter } from '@/routes/intensification.routes'
import { intensificationAttendanceRouter } from '@/routes/intensificationAttendance.routes'
import notificationRoutes from '@/routes/notification.routes'
import { riteRouter } from '@/routes/rite.routes'
import { studentRouter } from '@/routes/student.routes'
import { teacherAssignmentRouter } from '@/routes/teacherAssignment.routes'
import { edteTeamMemberRouter } from '@/routes/edteTeamMember.routes'
import { userRouter } from '@/routes/user.routes'

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
router.use('/institutional-config', institutionalConfigRouter)
// Las rutas de cursos se montan también en la raíz para que /api/subjects siga funcionando
router.use('/', courseRoutes)
router.use('/courses', courseRoutes)
router.use('/rites', riteRouter)
router.use('/edte-members', edteTeamMemberRouter)
// Calendario de períodos de intensificación (CRM-055)
router.use('/intensification-schedules', intensificationScheduleRouter)
router.use('/intensifications', intensificationRouter)
// Asistencia en intensificación (CRM-059)
router.use('/intensification-attendance', intensificationAttendanceRouter)
// Cierre del ciclo lectivo y alta de MPAA (CRM-052)
router.use('/cycle-closure', cycleClosureRouter)

export default router
