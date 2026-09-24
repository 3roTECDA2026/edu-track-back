import { AttendanceValue, PrismaClient, Role, Shift, StudentStatus, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
  academicYear: '00000000-0000-0000-0000-000000000001',
  teacher: '00000000-0000-0000-0000-000000000010',
  section: '00000000-0000-0000-0000-000000000020',
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
};

async function main() {
  await prisma.academicYear.upsert({
    where: { id: ids.academicYear },
    update: {},
    create: { id: ids.academicYear, year: 2026, active: true },
  });

  await prisma.user.upsert({
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
  });

  const sections = [
    { id: ids.sections[0], grade: 3, division: 'A', shift: Shift.MORNING },
    { id: ids.sections[1], grade: 2, division: 'B', shift: Shift.AFTERNOON },
    { id: ids.sections[2], grade: 4, division: 'A', shift: Shift.MORNING },
  ];

  for (const section of sections) {
    await prisma.classSection.upsert({
      where: { id: section.id },
      update: {},
      create: { ...section, academicYearId: ids.academicYear },
    });
  }

  const students = [
    { id: ids.students[0], dni: '45111222', lastName: 'Pérez', firstName: 'Sofía', recordNumber: 'LEGAJO-001', sectionId: ids.sections[0] },
    { id: ids.students[1], dni: '46222333', lastName: 'García', firstName: 'Mateo', recordNumber: 'LEGAJO-002', sectionId: ids.sections[0] },
    { id: ids.students[2], dni: '47333444', lastName: 'Luna', firstName: 'Camila', recordNumber: 'LEGAJO-003', sectionId: ids.sections[0] },
    { id: ids.students[3], dni: '48444555', lastName: 'Romero', firstName: 'Agustina', recordNumber: 'LEGAJO-004', sectionId: ids.sections[1] },
    { id: ids.students[4], dni: '49555666', lastName: 'Díaz', firstName: 'Tomás', recordNumber: 'LEGAJO-005', sectionId: ids.sections[1] },
    { id: ids.students[5], dni: '50666777', lastName: 'Benítez', firstName: 'Valentina', recordNumber: 'LEGAJO-006', sectionId: ids.sections[2] },
  ];

  for (const student of students) {
    await prisma.student.upsert({
      where: { id: student.id },
      update: {},
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
    });
  }

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
  ];

  for (const attendance of attendances) {
    const attendanceDate = new Date(`${attendance.date}T00:00:00.000Z`);
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
        registeredById: ids.teacher,
      },
      create: {
        ...attendance,
        date: attendanceDate,
        sectionId: attendance.sectionId,
        registeredById: ids.teacher,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Datos de prueba creados correctamente.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
