
import { Router } from 'express'

import authRouter from '@/routes/auth.routes'
import attendanceRouter from '@/routes/attendance.routes'
import { classSectionRouter } from '@/routes/classSection.routes'
import courseRoutes from '@/routes/course.routes'
import { enrollmentRouter } from '@/routes/enrollment.routes'
import { gradeRouter } from '@/routes/grade.routes'
import notificationRoutes from '@/routes/notification.routes'
import { studentRouter } from '@/routes/student.routes'
import { teacherAssignmentRouter } from '@/routes/teacherAssignment.routes'
import { userRouter } from '@/routes/user.routes'

const router = Router()

// Autenticación
router.use('/auth', authRouter)

// Usuarios
router.use('/users', userRouter)

// Estudiantes
router.use('/students', studentRouter)

// Inscripciones
router.use('/enrollments', enrollmentRouter)

// Calificaciones
router.use('/grades', gradeRouter)

// Cursos y divisiones
router.use('/class-sections', classSectionRouter)

// Asignación de docentes
router.use('/teacher-assignments', teacherAssignmentRouter)

// Asistencia
router.use('/attendance', attendanceRouter)

// Notificaciones
router.use('/notifications', notificationRoutes)

// Cursos
router.use('/courses', courseRoutes)

export default router
