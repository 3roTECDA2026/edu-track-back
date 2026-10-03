import process from 'node:process'

import {
  AlertSeverity,
  AlertType,
  AttendanceValue,
  Prisma,
  PrismaClient,
  Role,
  Shift,
  StudentStatus,
  UserStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

type Scores = (number | null)[]

// UUIDs fijos para la base de pruebas de EduTrack
const ids = {
  academicYear: '00000000-0000-0000-0000-000000000001',
  teacher: '00000000-0000-0000-0000-000000000010',
  sections: [
    '00000000-0000-0000-0000-000000000020', // 3° A Mañana
    '00000000-0000-0000-0000-000000000021', // 2° B Tarde
    '00000000-0000-0000-0000-000000000022', // 4° A Mañana
  ],
  students: [
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000106',
  ],
} as const

export async function main() {
  console.log('🌱 Ejecutando seed unificado de EduTrack...')

  // 1. Ciclo Lectivo 2026
  const academicYear = await prisma.academicYear.upsert({
    where: { id: ids.academicYear },
    update: { active: true },
    create: {
      id: ids.academicYear,
      year: 2026,
      active: true,
    },
  })

  // 2. Docente de prueba
  const teacher = await prisma.user.upsert({
    where: { id: ids.teacher },
    update: {},
    create: {
      id: ids.teacher,
      firstName: 'Usuario',
      lastName: 'Prueba',
      email: 'docente.prueba@edutrack.local',
      passwordHash: 'hash-de-prueba',
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
    },
  })

  // 3. Materias (Matemática y Lengua)
  const matematica = await prisma.subject.upsert({
    where: { code: 'MAT-TEST' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000200',
      name: 'Matemática',
      code: 'MAT-TEST',
      hoursPerWeek: 5,
      gradeLevel: 1,
      area: 'Ciencias Exactas',
    },
  })

  const lengua = await prisma.subject.upsert({
    where: { code: 'LEN-TEST' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      name: 'Lengua',
      code: 'LEN-TEST',
      hoursPerWeek: 4,
      gradeLevel: 1,
      area: 'Ciencias Sociales y Humanidades',
    },
  })

  // 4. Secciones (Cursos generales)
  const sections = [
    { id: ids.sections[0], grade: 3, division: 'A', shift: Shift.MORNING },
    { id: ids.sections[1], grade: 2, division: 'B', shift: Shift.AFTERNOON },
    { id: ids.sections[2], grade: 4, division: 'A', shift: Shift.MORNING },
  ]

  for (const section of sections) {
    await prisma.classSection.upsert({
      where: { id: section.id },
      update: {
        grade: section.grade,
        division: section.division,
        shift: section.shift,
      },
      create: {
        id: section.id,
        grade: section.grade,
        division: section.division,
        shift: section.shift,
        academicYear: { connect: { id: academicYear.id } },
      },
    })
  }

  // Seccion específica de 1° A Mañana para la grilla de calificaciones
  let section1A = await prisma.classSection.findFirst({
    where: { grade: 1, division: 'A', shift: Shift.MORNING, academicYearId: academicYear.id },
  })

  if (!section1A) {
    section1A = await prisma.classSection.create({
      data: {
        id: '00000000-0000-0000-0000-00000000001A',
        grade: 1,
        division: 'A',
        shift: Shift.MORNING,
        academicYearId: academicYear.id,
      },
    })
  }

  // 5. Alumnos Generales
  const generalStudents = [
    { id: ids.students[0], dni: '45111222', lastName: 'Pérez', firstName: 'Sofía', recordNumber: 'LEGAJO-001', sectionId: ids.sections[0] },
    { id: ids.students[1], dni: '46222333', lastName: 'García', firstName: 'Mateo', recordNumber: 'LEGAJO-002', sectionId: ids.sections[0] },
    { id: ids.students[2], dni: '47333444', lastName: 'Luna', firstName: 'Camila', recordNumber: 'LEGAJO-003', sectionId: ids.sections[0] },
    { id: ids.students[3], dni: '48444555', lastName: 'Romero', firstName: 'Agustina', recordNumber: 'LEGAJO-004', sectionId: ids.sections[1] },
    { id: ids.students[4], dni: '49555666', lastName: 'Díaz', firstName: 'Tomás', recordNumber: 'LEGAJO-005', sectionId: ids.sections[1] },
    { id: ids.students[5], dni: '50666777', lastName: 'Benítez', firstName: 'Valentina', recordNumber: 'LEGAJO-006', sectionId: ids.sections[2] },
  ]

  for (const student of generalStudents) {
    await prisma.student.upsert({
      where: { id: student.id },
      update: {
        dni: student.dni,
        lastName: student.lastName,
        firstName: student.firstName,
        recordNumber: student.recordNumber,
      },
      create: {
        id: student.id,
        dni: student.dni,
        lastName: student.lastName,
        firstName: student.firstName,
        recordNumber: student.recordNumber,
        dateOfBirth: new Date('2010-04-12'),
        address: 'Domicilio de prueba 123',
        status: StudentStatus.ACTIVE,
      },
    })

    const historyId = `00000000-0000-0000-0000-0000000${student.id.slice(-5)}`
    await prisma.enrollmentHistory.upsert({
      where: { id: historyId },
      update: {
        classSection: { connect: { id: student.sectionId } },
        student: { connect: { id: student.id } },
      },
      create: {
        id: historyId,
        student: { connect: { id: student.id } },
        classSection: { connect: { id: student.sectionId } },
      },
    })
  }

  // 6. Alumnos para Grilla de Calificaciones (1° A)
  const gradeStudentsSeed = [
    { dni: '50000001', lastName: 'Acosta', firstName: 'María' },
    { dni: '50000002', lastName: 'Benítez', firstName: 'Juan' },
    { dni: '50000003', lastName: 'Castro', firstName: 'Lucía' },
    { dni: '50000004', lastName: 'Díaz', firstName: 'Mateo' },
    { dni: '50000005', lastName: 'Fernández', firstName: 'Sofía' },
    { dni: '50000006', lastName: 'Gómez', firstName: 'Tomás' },
    { dni: '50000007', lastName: 'Herrera', firstName: 'Valentina' },
    { dni: '50000008', lastName: 'Ibáñez', firstName: 'Lautaro' },
  ]

  const gradeStudentsByDni: Record<string, string> = {}
  let idx = 1
  for (const s of gradeStudentsSeed) {
    const student = await prisma.student.upsert({
      where: { dni: s.dni },
      update: {},
      create: {
        dni: s.dni,
        lastName: s.lastName,
        firstName: s.firstName,
        dateOfBirth: new Date('2012-03-15'),
        address: 'Calle Falsa 123',
        recordNumber: `LEG-TEST-${String(idx).padStart(4, '0')}`,
        status: StudentStatus.ACTIVE,
      },
    })
    gradeStudentsByDni[s.dni] = student.id
    idx += 1
  }

  // Helpers para inscripciones y notas
  async function ensureEnrollment(studentId: string, subjectId: string) {
    let enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        subjectId,
        academicYearId: academicYear.id,
        courseType: 'FIRST_TIME',
      },
    })
    if (!enrollment) {
      enrollment = await prisma.enrollment.create({
        data: {
          studentId,
          subjectId,
          classSectionId: section1A.id,
          academicYearId: academicYear.id,
        },
      })
    }
    return enrollment.id
  }

  async function setGrade(enrollmentId: string, term1?: Scores, term2?: Scores) {
    const data: { term1Scores?: Prisma.InputJsonValue; term2Scores?: Prisma.InputJsonValue } = {}
    if (term1) data.term1Scores = term1 as Prisma.InputJsonValue
    if (term2) data.term2Scores = term2 as Prisma.InputJsonValue
    await prisma.grade.upsert({
      where: { enrollmentId },
      update: data,
      create: { enrollmentId, ...data },
    })
  }

  // Carga de Calificaciones: Matemática
  const matGrades: Array<{ dni: string; t1?: Scores; t2?: Scores }> = [
    { dni: '50000001', t1: [8, 7, null, 9], t2: [10, null, 6, 7] }, // Acosta
    { dni: '50000002', t1: [6, 6, 7, 5], t2: [7, 6, 6, 8] },        // Benítez
    { dni: '50000003', t1: [9, 10, 9, 8], t2: [10, 9, 10, 9] },     // Castro
    { dni: '50000004', t1: [3, 4, 2, 5], t2: [4, 5, null, 4] },     // Díaz (rojo)
    { dni: '50000005', t1: [7, 8, null, null] },                    // Fernández (2° sin cargar)
    { dni: '50000006' },                                            // Gómez (sin nota)
    { dni: '50000007', t1: [5, 6, 6, 7], t2: [6, 7, 7, 6] },        // Herrera
    { dni: '50000008' },                                            // Ibáñez (sin nota)
  ]

  let firstEnrollmentId = ''
  for (const r of matGrades) {
    const enrollmentId = await ensureEnrollment(gradeStudentsByDni[r.dni], matematica.id)
    if (!firstEnrollmentId) firstEnrollmentId = enrollmentId
    if (r.t1 || r.t2) await setGrade(enrollmentId, r.t1, r.t2)
  }

  // Carga de Calificaciones: Lengua
  const lenGrades: Array<{ dni: string; t1?: Scores; t2?: Scores }> = [
    { dni: '50000001', t1: [9, 8, 8, 7], t2: [8, 9, 8, 9] },  // Acosta
    { dni: '50000002', t1: [6, 5, 6, 6], t2: [7, 6, 5, 6] },  // Benítez
    { dni: '50000003', t1: [10, 9, 9, 10], t2: [9, 10, 10, 9] }, // Castro
    { dni: '50000004', t1: [4, 3, 5, 4] },                    // Díaz (2° sin cargar)
    { dni: '50000005' },                                      // Fernández (sin nota)
  ]
  for (const r of lenGrades) {
    const enrollmentId = await ensureEnrollment(gradeStudentsByDni[r.dni], lengua.id)
    if (r.t1 || r.t2) await setGrade(enrollmentId, r.t1, r.t2)
  }

  // 7. Asistencias Diarias de Prueba
  const attendances = [
    { id: '00000000-0000-0000-0000-000000001001', studentId: ids.students[0], sectionId: ids.sections[0], date: '2026-09-10', value: AttendanceValue.ABSENT, justification: 'Certificado médico', justified: true },
    { id: '00000000-0000-0000-0000-000000001002', studentId: ids.students[0], sectionId: ids.sections[0], date: '2026-09-11', value: AttendanceValue.HALF, justification: null, justified: false },
    { id: '00000000-0000-0000-0000-000000001003', studentId: ids.students[1], sectionId: ids.sections[0], date: '2026-09-10', value: AttendanceValue.ABSENT, justification: null, justified: false },
    { id: '00000000-0000-0000-0000-000000001004', studentId: ids.students[1], sectionId: ids.sections[0], date: '2026-09-12', value: AttendanceValue.QUARTER, justification: null, justified: false },
    { id: '00000000-0000-0000-0000-000000001005', studentId: ids.students[2], sectionId: ids.sections[0], date: '2026-09-14', value: AttendanceValue.ABSENT, justification: 'Turno médico', justified: true },
    { id: '00000000-0000-0000-0000-000000001006', studentId: ids.students[3], sectionId: ids.sections[1], date: '2026-09-09', value: AttendanceValue.ABSENT, justification: null, justified: false },
    { id: '00000000-0000-0000-0000-000000001007', studentId: ids.students[3], sectionId: ids.sections[1], date: '2026-09-13', value: AttendanceValue.ABSENT, justification: 'Certificado médico', justified: true },
    { id: '00000000-0000-0000-0000-000000001008', studentId: ids.students[4], sectionId: ids.sections[1], date: '2026-09-08', value: AttendanceValue.QUARTER, justification: null, justified: false },
    { id: '00000000-0000-0000-0000-000000001009', studentId: ids.students[5], sectionId: ids.sections[2], date: '2026-09-15', value: AttendanceValue.HALF, justification: 'Actividad institucional', justified: true },
    { id: '00000000-0000-0000-0000-000000001010', studentId: ids.students[5], sectionId: ids.sections[2], date: '2026-09-16', value: AttendanceValue.ABSENT, justification: null, justified: false },
  ]

  for (const attendance of attendances) {
    const attendanceDate = new Date(`${attendance.date}T00:00:00.000Z`)

    await prisma.dailyAttendance.upsert({
      where: {
        studentId_date_sectionId: {
          studentId: attendance.studentId,
          date: attendanceDate,
          sectionId: attendance.sectionId,
        },
      },
      update: {
        value: attendance.value,
        justification: attendance.justification,
        justified: attendance.justified,
        registeredBy: { connect: { id: teacher.id } },
      },
      create: {
        id: attendance.id,
        value: attendance.value,
        justification: attendance.justification,
        justified: attendance.justified,
        date: attendanceDate,
        student: { connect: { id: attendance.studentId } },
        section: { connect: { id: attendance.sectionId } },
        registeredBy: { connect: { id: teacher.id } },
      },
    })
  }

  // 8. Alertas / Notificaciones
  const alertDefinitions = [
    { id: '00000000-0000-0000-0000-000000002001', studentId: ids.students[0], type: AlertType.HEALTH, message: 'Se reportó ausencia por enfermedad con certificado médico vigente.' },
    { id: '00000000-0000-0000-0000-000000002002', studentId: ids.students[1], type: AlertType.CONDUCT, message: 'Se registró falta de respeto en clase y se requiere seguimiento de convivencia.' },
    { id: '00000000-0000-0000-0000-000000002003', studentId: ids.students[3], type: AlertType.HEALTH, message: 'El estudiante presenta tratamiento médico y requiere apoyo pedagógico.' },
    { id: '00000000-0000-0000-0000-000000002004', studentId: ids.students[4], type: AlertType.CONDUCT, message: 'Se evidenció conducta disruptiva durante la jornada escolar y se citó a entrevista.' },
    { id: '00000000-0000-0000-0000-000000002005', studentId: ids.students[2], type: AlertType.PENDING_SUBJECTS, severity: AlertSeverity.HIGH, message: 'Rendimiento bajo en Matemática: promedio actual 3,5. Se recomienda acordar actividades de apoyo y revisar avances en el próximo período.' },
    { id: '00000000-0000-0000-0000-000000002006', studentId: ids.students[5], type: AlertType.PENDING_SUBJECTS, severity: AlertSeverity.HIGH, message: 'Presenta calificaciones inferiores a 4 en Matemática y Prácticas del Lenguaje. Requiere seguimiento y acompañamiento pedagógico.' },
  ]

  for (const alert of alertDefinitions) {
    await prisma.notification.upsert({
      where: { id: alert.id },
      update: {
        type: alert.type,
        severity: alert.severity ?? AlertSeverity.MEDIUM,
        message: alert.message,
        read: false,
      },
      create: {
        id: alert.id,
        student: { connect: { id: alert.studentId } },
        type: alert.type,
        severity: alert.severity ?? AlertSeverity.MEDIUM,
        message: alert.message,
        read: false,
      },
    })
  }

  console.log('✅ Datos de prueba creados correctamente.')
  console.log(`👉 1° A cargado con ${gradeStudentsSeed.length} alumnos para la grilla (Matemática y Lengua).`)
  console.log('👉 Se incorporaron alertas de salud, conducta y bajo rendimiento.')
  console.log('👉 Primer enrollmentId de prueba:', firstEnrollmentId)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch(async (e) => {
      console.error('❌ Error ejecutando el seed:', e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}