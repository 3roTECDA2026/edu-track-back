import process from 'node:process'

import {
  AlertSeverity,
  AlertType,
  AttendanceValue,
  PrismaClient,
  Role,
  Shift,
  StudentStatus,
  UserStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

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

const testSubject = {
  id: '00000000-0000-0000-0000-000000000200',
  code: 'MAT-TEST',
  name: 'Matemática',
  hoursPerWeek: 5,
  gradeLevel: 1,
  area: 'Ciencias Exactas',
}

export async function main() {
  console.log('🌱 Ejecutando seed unificado de EduTrack...')

  const academicYear = await prisma.academicYear.upsert({
    where: { id: ids.academicYear },
    update: { active: true },
    create: {
      id: ids.academicYear,
      year: 2026,
      active: true,
    },
  })

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

  const students = [
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

  for (const student of students) {
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

  const testSubjectRecord = await prisma.subject.upsert({
    where: { code: testSubject.code },
    update: {},
    create: {
      id: testSubject.id,
      name: testSubject.name,
      code: testSubject.code,
      hoursPerWeek: testSubject.hoursPerWeek,
      gradeLevel: testSubject.gradeLevel,
      area: testSubject.area,
    },
  })

  const gradeTestStudent = await prisma.student.upsert({
    where: { dni: '50000001' },
    update: {},
    create: {
      dni: '50000001',
      lastName: 'Acosta',
      firstName: 'María',
      dateOfBirth: new Date('2012-03-15'),
      address: 'Calle Falsa 123',
      recordNumber: 'LEG-TEST-0001',
    },
  })

  let testClassSection = await prisma.classSection.findFirst({
    where: { grade: 1, division: 'A', shift: 'MORNING', academicYearId: academicYear.id },
  })

  if (!testClassSection) {
    testClassSection = await prisma.classSection.create({
      data: {
        grade: 1,
        division: 'A',
        shift: 'MORNING',
        academicYearId: academicYear.id,
      },
    })
  }

  let enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: gradeTestStudent.id,
      subjectId: testSubjectRecord.id,
      academicYearId: academicYear.id,
      courseType: 'FIRST_TIME',
    },
  })

  if (!enrollment) {
    enrollment = await prisma.enrollment.create({
      data: {
        studentId: gradeTestStudent.id,
        subjectId: testSubjectRecord.id,
        classSectionId: testClassSection.id,
        academicYearId: academicYear.id,
      },
    })
  }

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

  const alertDefinitions = [
    {
      id: '00000000-0000-0000-0000-000000002001',
      studentId: ids.students[0],
      type: AlertType.HEALTH,
      message: 'Se reportó ausencia por enfermedad con certificado médico vigente.',
    },
    {
      id: '00000000-0000-0000-0000-000000002002',
      studentId: ids.students[1],
      type: AlertType.CONDUCT,
      message: 'Se registró falta de respeto en clase y se requiere seguimiento de convivencia.',
    },
    {
      id: '00000000-0000-0000-0000-000000002003',
      studentId: ids.students[3],
      type: AlertType.HEALTH,
      message: 'El estudiante presenta tratamiento médico y requiere apoyo pedagógico.',
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
        student: { connect: { id: alert.studentId } },
        type: alert.type,
        severity: alert.severity ?? AlertSeverity.MEDIUM,
        message: alert.message,
        read: false,
      },
    })
  }

  console.log('✅ Datos de prueba creados correctamente.')
  console.log('👉 Se incorporaron alertas de salud, conducta y bajo rendimiento.')
  console.log('👉 enrollmentId para probar el POST:', enrollment.id)
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
