
import 'dotenv/config'
import process from 'node:process'
import bcrypt from 'bcrypt'

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

const ids = {
  academicYear: '00000000-0000-0000-0000-000000000001',
  teacher: '00000000-0000-0000-0000-000000000010',
  sections: [
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000022',
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
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No ejecutar el seed en producción')
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD

  if (
    !adminPassword ||
    adminPassword.length < 8 ||
    !teacherPassword ||
    teacherPassword.length < 8
  ) {
    throw new Error(
      'Configurá SEED_ADMIN_PASSWORD y SEED_TEACHER_PASSWORD en .env (mínimo 8 caracteres)',
    )
  }

  console.log('🌱 Ejecutando seed unificado de Notar...')

  // ============================================================
  // 1. CICLO LECTIVO 2026
  // ============================================================

  const academicYear = await prisma.academicYear.upsert({
    where: { id: ids.academicYear },
    update: { active: true },
    create: {
      id: ids.academicYear,
      year: 2026,
      active: true,
    },
  })

  // ============================================================
  // 2. USUARIOS DE PRUEBA
  // ============================================================

  const adminEmail = 'admin@notar.local'
  const teacherEmail = 'docente.prueba@notar.local'

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        firstName: 'Administrador',
        lastName: 'Notar',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: Role.ADMINISTRATOR,
        status: UserStatus.ACTIVE,
      },
    })

    console.log('✅ Administrador creado')
  } else {
    console.log('ℹ️ Administrador existente, sin modificaciones')
  }

  const existingTeacher = await prisma.user.findUnique({
    where: { id: ids.teacher },
  })

  let teacher: { id: string }

  if (!existingTeacher) {
    teacher = await prisma.user.create({
      data: {
        id: ids.teacher,
        firstName: 'Usuario',
        lastName: 'Prueba',
        email: teacherEmail,
        passwordHash: await bcrypt.hash(teacherPassword, 12),
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
      },
    })

    console.log('✅ Docente creado')
  } else if (existingTeacher.passwordHash === 'hash-de-prueba') {
    teacher = await prisma.user.update({
      where: { id: ids.teacher },
      data: {
        passwordHash: await bcrypt.hash(teacherPassword, 12),
      },
    })

    console.log('✅ Contraseña ficticia del docente corregida')
  } else {
    teacher = existingTeacher
    console.log('ℹ️ Docente existente, contraseña conservada')
  }

  // ============================================================
  // 3. MATERIAS
  // ============================================================

  const matematica = await prisma.subject.upsert({
    where: { code: 'MAT-TEST' },
    update: {},
    create: {
      id: '7487031d-db90-4732-a844-3ed3b324aba4',
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

  // ============================================================
  // 4. CURSOS Y DIVISIONES
  // ============================================================

  const sections = [
    {
      id: ids.sections[0],
      grade: 3,
      division: 'A',
      shift: Shift.MORNING,
    },
    {
      id: ids.sections[1],
      grade: 2,
      division: 'B',
      shift: Shift.AFTERNOON,
    },
    {
      id: ids.sections[2],
      grade: 4,
      division: 'A',
      shift: Shift.MORNING,
    },
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
        academicYear: {
          connect: { id: academicYear.id },
        },
      },
    })
  }

  // ============================================================
  // 5. CURSO 1° A MAÑANA
  // ============================================================

  let section1A = await prisma.classSection.findFirst({
    where: {
      grade: 1,
      division: 'A',
      shift: Shift.MORNING,
      academicYearId: academicYear.id,
    },
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

  const section1AId: string = section1A.id

  // ============================================================
  // 6. ALUMNOS GENERALES
  // ============================================================

  const generalStudents = [
    {
      id: ids.students[0],
      dni: '45111222',
      lastName: 'Pérez',
      firstName: 'Sofía',
      recordNumber: 'LEGAJO-001',
      sectionId: ids.sections[0],
    },
    {
      id: ids.students[1],
      dni: '46222333',
      lastName: 'García',
      firstName: 'Mateo',
      recordNumber: 'LEGAJO-002',
      sectionId: ids.sections[0],
    },
    {
      id: ids.students[2],
      dni: '47333444',
      lastName: 'Luna',
      firstName: 'Camila',
      recordNumber: 'LEGAJO-003',
      sectionId: ids.sections[0],
    },
    {
      id: ids.students[3],
      dni: '48444555',
      lastName: 'Romero',
      firstName: 'Agustina',
      recordNumber: 'LEGAJO-004',
      sectionId: ids.sections[1],
    },
    {
      id: ids.students[4],
      dni: '49555666',
      lastName: 'Díaz',
      firstName: 'Tomás',
      recordNumber: 'LEGAJO-005',
      sectionId: ids.sections[1],
    },
    {
      id: ids.students[5],
      dni: '50666777',
      lastName: 'Benítez',
      firstName: 'Valentina',
      recordNumber: 'LEGAJO-006',
      sectionId: ids.sections[2],
    },
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

    const historyId =
      `00000000-0000-0000-0000-0000000${student.id.slice(-5)}`

    await prisma.enrollmentHistory.upsert({
      where: { id: historyId },
      update: {
        classSection: {
          connect: { id: student.sectionId },
        },
        student: {
          connect: { id: student.id },
        },
      },
      create: {
        id: historyId,
        student: {
          connect: { id: student.id },
        },
        classSection: {
          connect: { id: student.sectionId },
        },
      },
    })
  }

  // ============================================================
  // 7. ALUMNOS PARA GRILLA DE CALIFICACIONES
  // ============================================================

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

  // ============================================================
  // 8. HELPERS PARA INSCRIPCIONES Y NOTAS
  // ============================================================

  async function ensureEnrollment(
    studentId: string,
    subjectId: string,
  ) {
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
          classSectionId: section1AId,
          academicYearId: academicYear.id,
        },
      })
    }

    return enrollment.id
  }

  async function setGrade(
    enrollmentId: string,
    term1?: Scores,
    term2?: Scores,
  ) {
    const data: {
      term1Scores?: Prisma.InputJsonValue
      term2Scores?: Prisma.InputJsonValue
    } = {}

    if (term1) {
      data.term1Scores = term1 as Prisma.InputJsonValue
    }

    if (term2) {
      data.term2Scores = term2 as Prisma.InputJsonValue
    }

    await prisma.grade.upsert({
      where: { enrollmentId },
      update: data,
      create: {
        enrollmentId,
        ...data,
      },
    })
  }

  // ============================================================
  // 9. CALIFICACIONES DE MATEMÁTICA
  // ============================================================

  const matGrades: Array<{
    dni: string
    t1?: Scores
    t2?: Scores
  }> = [
    {
      dni: '50000001',
      t1: [8, 7, null, 9],
      t2: [10, null, 6, 7],
    },
    {
      dni: '50000002',
      t1: [6, 6, 7, 5],
      t2: [7, 6, 6, 8],
    },
    {
      dni: '50000003',
      t1: [9, 10, 9, 8],
      t2: [10, 9, 10, 9],
    },
    {
      dni: '50000004',
      t1: [3, 4, 2, 5],
      t2: [4, 5, null, 4],
    },
    {
      dni: '50000005',
      t1: [7, 8, null, null],
    },
    {
      dni: '50000006',
    },
    {
      dni: '50000007',
      t1: [5, 6, 6, 7],
      t2: [6, 7, 7, 6],
    },
    {
      dni: '50000008',
    },
  ]

  let firstEnrollmentId = ''

  for (const r of matGrades) {
    const studentId = gradeStudentsByDni[r.dni]

    if (!studentId) {
      throw new Error(`No se encontró el estudiante con DNI ${r.dni}`)
    }

    const enrollmentId = await ensureEnrollment(
      studentId,
      matematica.id,
    )

    if (!firstEnrollmentId) {
      firstEnrollmentId = enrollmentId
    }

    if (r.t1 || r.t2) {
      await setGrade(enrollmentId, r.t1, r.t2)
    }
  }

  // ============================================================
  // 10. CALIFICACIONES DE LENGUA
  // ============================================================

  const lenGrades: Array<{
    dni: string
    t1?: Scores
    t2?: Scores
  }> = [
    {
      dni: '50000001',
      t1: [9, 8, 8, 7],
      t2: [8, 9, 8, 9],
    },
    {
      dni: '50000002',
      t1: [6, 5, 6, 6],
      t2: [7, 6, 5, 6],
    },
    {
      dni: '50000003',
      t1: [10, 9, 9, 10],
      t2: [9, 10, 10, 9],
    },
    {
      dni: '50000004',
      t1: [4, 3, 5, 4],
    },
    {
      dni: '50000005',
    },
  ]

  for (const r of lenGrades) {
    const studentId = gradeStudentsByDni[r.dni]

    if (!studentId) {
      throw new Error(`No se encontró el estudiante con DNI ${r.dni}`)
    }

    const enrollmentId = await ensureEnrollment(
      studentId,
      lengua.id,
    )

    if (r.t1 || r.t2) {
      await setGrade(enrollmentId, r.t1, r.t2)
    }
  }

  // ============================================================
  // 11. ASISTENCIAS DIARIAS
  // ============================================================

  const attendances = [
    {
      id: '00000000-0000-0000-0000-000000001001',
      studentId: ids.students[0],
      sectionId: ids.sections[0],
      date: '2026-09-10',
      value: AttendanceValue.ABSENT,
      justification: 'Certificado médico',
      justified: true,
    },
    {
      id: '00000000-0000-0000-0000-000000001002',
      studentId: ids.students[0],
      sectionId: ids.sections[0],
      date: '2026-09-11',
      value: AttendanceValue.HALF,
      justification: null,
      justified: false,
    },
    {
      id: '00000000-0000-0000-0000-000000001003',
      studentId: ids.students[1],
      sectionId: ids.sections[0],
      date: '2026-09-10',
      value: AttendanceValue.ABSENT,
      justification: null,
      justified: false,
    },
    {
      id: '00000000-0000-0000-0000-000000001004',
      studentId: ids.students[1],
      sectionId: ids.sections[0],
      date: '2026-09-12',
      value: AttendanceValue.QUARTER,
      justification: null,
      justified: false,
    },
    {
      id: '00000000-0000-0000-0000-000000001005',
      studentId: ids.students[2],
      sectionId: ids.sections[0],
      date: '2026-09-14',
      value: AttendanceValue.ABSENT,
      justification: 'Turno médico',
      justified: true,
    },
    {
      id: '00000000-0000-0000-0000-000000001006',
      studentId: ids.students[3],
      sectionId: ids.sections[1],
      date: '2026-09-09',
      value: AttendanceValue.ABSENT,
      justification: null,
      justified: false,
    },
    {
      id: '00000000-0000-0000-0000-000000001007',
      studentId: ids.students[3],
      sectionId: ids.sections[1],
      date: '2026-09-13',
      value: AttendanceValue.ABSENT,
      justification: 'Certificado médico',
      justified: true,
    },
    {
      id: '00000000-0000-0000-0000-000000001008',
      studentId: ids.students[4],
      sectionId: ids.sections[1],
      date: '2026-09-08',
      value: AttendanceValue.QUARTER,
      justification: null,
      justified: false,
    },
    {
      id: '00000000-0000-0000-0000-000000001009',
      studentId: ids.students[5],
      sectionId: ids.sections[2],
      date: '2026-09-15',
      value: AttendanceValue.HALF,
      justification: 'Actividad institucional',
      justified: true,
    },
    {
      id: '00000000-0000-0000-0000-000000001010',
      studentId: ids.students[5],
      sectionId: ids.sections[2],
      date: '2026-09-16',
      value: AttendanceValue.ABSENT,
      justification: null,
      justified: false,
    },
  ]

  for (const attendance of attendances) {
    const attendanceDate = new Date(
      `${attendance.date}T00:00:00.000Z`,
    )

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
        registeredBy: {
          connect: { id: teacher.id },
        },
      },
      create: {
        id: attendance.id,
        value: attendance.value,
        justification: attendance.justification,
        justified: attendance.justified,
        date: attendanceDate,
        student: {
          connect: { id: attendance.studentId },
        },
        section: {
          connect: { id: attendance.sectionId },
        },
        registeredBy: {
          connect: { id: teacher.id },
        },
      },
    })
  }

  // ============================================================
  // 12. ALERTAS Y NOTIFICACIONES
  // ============================================================

  const alertDefinitions = [
    {
      id: '00000000-0000-0000-0000-000000002001',
      studentId: ids.students[0],
      type: AlertType.HEALTH,
      message:
        'Se reportó ausencia por enfermedad con certificado médico vigente.',
    },
    {
      id: '00000000-0000-0000-0000-000000002002',
      studentId: ids.students[1],
      type: AlertType.CONDUCT,
      message:
        'Se registró falta de respeto en clase y se requiere seguimiento de convivencia.',
    },
    {
      id: '00000000-0000-0000-0000-000000002003',
      studentId: ids.students[3],
      type: AlertType.HEALTH,
      message:
        'El estudiante presenta tratamiento médico y requiere apoyo pedagógico.',
    },
    {
      id: '00000000-0000-0000-0000-000000002004',
      studentId: ids.students[4],
      type: AlertType.CONDUCT,
      message:
        'Se evidenció conducta disruptiva durante la jornada escolar y se citó a entrevista.',
    },
    {
      id: '00000000-0000-0000-0000-000000002005',
      studentId: ids.students[2],
      type: AlertType.PENDING_SUBJECTS,
      severity: AlertSeverity.HIGH,
      message:
        'Rendimiento bajo en Matemática: promedio actual 3,5. Se recomienda acordar actividades de apoyo y revisar avances en el próximo período.',
    },
    {
      id: '00000000-0000-0000-0000-000000002006',
      studentId: ids.students[5],
      type: AlertType.PENDING_SUBJECTS,
      severity: AlertSeverity.HIGH,
      message:
        'Presenta calificaciones inferiores a 4 en Matemática y Prácticas del Lenguaje. Requiere seguimiento y acompañamiento pedagógico.',
    },
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
        student: {
          connect: { id: alert.studentId },
        },
        type: alert.type,
        severity: alert.severity ?? AlertSeverity.MEDIUM,
        message: alert.message,
        read: false,
      },
    })
  }

  // ============================================================
  // FINALIZACIÓN
  // ============================================================

  console.log('✅ Datos de prueba creados correctamente.')
  console.log('👤 Administrador: admin@notar.local')
  console.log('👤 Docente: docente.prueba@notar.local')
  console.log('🔐 Contraseñas configuradas desde .env')
  console.log(
    `👉 1° A cargado con ${gradeStudentsSeed.length} alumnos para la grilla.`,
  )
  console.log('👉 Alertas y asistencias incorporadas.')
  console.log('👉 Primer enrollmentId:', firstEnrollmentId)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error('❌ Error ejecutando el seed:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
