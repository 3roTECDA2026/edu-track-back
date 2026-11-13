import { Router } from 'express'

import attendanceRouter from '@/routes/attendance.routes'
import authRouter from '@/routes/auth.routes'
import { classSectionRouter } from '@/routes/classSection.routes'
import courseRoutes from '@/routes/course.routes'
import { cycleClosureRouter } from '@/routes/cycleClosure.routes'
import { edteReferralRouter } from '@/routes/edteReferral.routes'
import { enrollmentRouter } from '@/routes/enrollment.routes'
import { edteTeamMemberRouter } from '@/routes/edteTeamMember.routes'
import { fortePlanRouter } from '@/routes/fortePlan.routes'
import { gradeRouter } from '@/routes/grade.routes'
import { edteMeetingRouter } from '@/routes/edteMeeting.routes'
import { institutionalConfigRouter } from '@/routes/institutionalConfig.routes'
import { intensificationScheduleRouter } from '@/routes/intensificationSchedule.routes'
import { intensificationRouter } from '@/routes/intensification.routes'
import { intensificationAttendanceRouter } from '@/routes/intensificationAttendance.routes'
import { interventionRouter } from '@/routes/intervention.routes'
import notificationRoutes from '@/routes/notification.routes'
import { edteDashboardRouter } from '@/routes/edteDashboard.routes'
import { riteRouter } from '@/routes/rite.routes'
import { studentRouter } from '@/routes/student.routes'
import { pateRouter } from '@/routes/pate.routes'
import { subjectRepeatRouter } from '@/routes/subjectRepeat.routes'
import { teacherAssignmentRouter } from '@/routes/teacherAssignment.routes'
import { userRouter } from '@/routes/user.routes'
import { legalConflictRouter } from '@/routes/legalConflict.routes'
import { conflictTotpRouter } from '@/routes/conflictTotp.routes'
import { pendingSubjectRouter } from '@/routes/pendingSubject.routes'
import { promotionRouter } from '@/routes/promotion.routes'

const router = Router()

router.use('/auth', authRouter)
router.use('/students', studentRouter)
router.use('/enrollments', enrollmentRouter)
router.use('/grades', gradeRouter)
router.use('/class-sections', classSectionRouter)
router.use('/teacher-assignments', teacherAssignmentRouter)
// Dashboard del EDTE (CRM-077)
router.use('/edte-dashboard', edteDashboardRouter)
router.use('/attendance', attendanceRouter)
router.use('/notifications', notificationRoutes)
router.use('/users', userRouter)
// PATE (CRM-078)
router.use('/pates', pateRouter)
router.use('/institutional-config', institutionalConfigRouter)
// Las rutas de cursos se montan también en la raíz para que /api/subjects siga funcionando
router.use('/', courseRoutes)
router.use('/courses', courseRoutes)
router.use('/rites', riteRouter)
// Reuniones del EDTE (CRM-075)
router.use('/edte-meetings', edteMeetingRouter)
// Calendario de períodos de intensificación (CRM-055)
router.use('/intensification-schedules', intensificationScheduleRouter)
router.use('/intensifications', intensificationRouter)
// Asistencia en intensificación (CRM-059)
router.use('/intensification-attendance', intensificationAttendanceRouter)
router.use('/legal-conflicts', legalConflictRouter)
router.use('/conflict-totp', conflictTotpRouter)
// Bitácora de intervenciones
router.use('/interventions', interventionRouter)
// Cierre del ciclo lectivo y alta de MPAA (CRM-052)
router.use('/cycle-closure', cycleClosureRouter)
// Integrantes del EDTE (CRM-071)
router.use('/edte-team-members', edteTeamMemberRouter)
router.use('/pending-subjects', pendingSubjectRouter)
// Motor de promoción con auditoría (CRM-062)
router.use('/promotion', promotionRouter)
// Plan Forte (CRM-089)
router.use('/forte-plans', fortePlanRouter)
// Derivación al EDTE: alumnos con 5 o más MPAA (CRM-073)
router.use('/edte-referrals', edteReferralRouter)
// Recursado de materias (CRM-082)
router.use('/subject-repeats', subjectRepeatRouter)

export default router
