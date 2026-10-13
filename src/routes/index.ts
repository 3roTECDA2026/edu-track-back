
import { Router } from 'express'

import { teacherAssignmentRouter } from '@/routes/teacherAssignment.routes'
import attendanceRouter from '@/routes/attendance.routes'
import authRoutes from '@/routes/auth.routes'
import { classSectionRouter } from '@/routes/classSection.routes'
import courseRoutes from '@/routes/course.routes'
import { enrollmentRouter } from '@/routes/enrollment.routes'
import { gradeRouter } from '@/routes/grade.routes'
import notificationRoutes from '@/routes/notification.routes'
import { studentRouter } from '@/routes/student.routes'
import userRoutes from '@/routes/user.routes'

const router = Router()

// Gestión de usuarios
router.use('/users', userRoutes)

// Gestión escolar
router.use('/students', studentRouter)
router.use('/enrollments', enrollmentRouter)
router.use('/grades', gradeRouter)
router.use('/class-sections', classSectionRouter)
router.use('/teacher-assignments', teacherAssignmentRouter)
router.use('/attendance', attendanceRouter)
router.use('/notifications', notificationRoutes)

// Autenticación
router.use('/auth', authRoutes)

// Cursos
router.use('/', courseRoutes)

export default router
