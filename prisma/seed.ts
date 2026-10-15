import process from 'node:process'

import {
  AlertSeverity,
  AlertType,
  AttendanceValue,
  Orientation,
  Prisma,
  PrismaClient,
  Role,
  Shift,
  StudentStatus,
  UserStatus,
} from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const SALT_ROUNDS = 10

type Scores = (number | null)[]

// UUIDs fijos para la base de pruebas de Notar
const ids = {
  academicYear: '00000000-0000-0000-0000-000000000001',
  teacher: '00000000-0000-0000-0000-000000000010',
  teacher2: '00000000-0000-0000-0000-000000000011',
  schoolManagement: '00000000-0000-0000-0000-000000000012',
  eoe: '00000000-0000-0000-0000-000000000013',

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

  guardians: [
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0000-000000000306',
  ],
} as const

export async function main() {
  console.log('🌱 Ejecutando seed unificado de Notar...')

  // ============================================================
  // 1. Ciclo Lectivo 2026
  // ============================================================

  const academicYear = await prisma.academicYear.upsert({
    where: {
      year: 2026,
    },

    update: {
      active: true,
      term1StartDate: new Date('2026-03-02'),
      term1EndDate: new Date('2026-07-17'),
      term2StartDate: new Date('2026-08-03'),
      term2EndDate: new Date('2026-12-18'),
    },

    create: {
      id: ids.academicYear,
      year: 2026,
      active: true,
      term1StartDate: new Date('2026-03-02'),
      term1EndDate: new Date('2026-07-17'),
      term2StartDate: new Date('2026-08-03'),
      term2EndDate: new Date('2026-12-18'),
    },
  })

  // ============================================================
  // 2. Docente de prueba
  // ============================================================

  const adminPasswordHash = await bcrypt.hash('Admin1234!', SALT_ROUNDS)
  const staffPasswordHash = await bcrypt.hash('Docente1234!', SALT_ROUNDS)

  const teacher = await prisma.user.upsert({
    where: {
      id: ids.teacher,
    },

    update: {
      firstName: 'Carla',
      lastName: 'Méndez',
      email: 'docente.prueba@notar.local',
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
      passwordHash: staffPasswordHash,
    },

    create: {
      id: ids.teacher,
      firstName: 'Carla',
      lastName: 'Méndez',
      email: 'docente.prueba@notar.local',
      passwordHash: staffPasswordHash,
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
    },
  })

  const teacher2 = await prisma.user.upsert({
    where: {
      id: ids.teacher2,
    },

    update: {
      firstName: 'Diego',
      lastName: 'Suárez',
      email: 'diego.suarez@notar.local',
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
      passwordHash: staffPasswordHash,
    },

    create: {
      id: ids.teacher2,
      firstName: 'Diego',
      lastName: 'Suárez',
      email: 'diego.suarez@notar.local',
      passwordHash: staffPasswordHash,
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
    },
  })

  const schoolManagement = await prisma.user.upsert({
    where: {
      id: ids.schoolManagement,
    },

    update: {
      firstName: 'Marcela',
      lastName: 'Quiroga',
      email: 'direccion@notar.local',
      role: Role.SCHOOL_MANAGEMENT,
      status: UserStatus.ACTIVE,
      passwordHash: staffPasswordHash,
    },

    create: {
      id: ids.schoolManagement,
      firstName: 'Marcela',
      lastName: 'Quiroga',
      email: 'direccion@notar.local',
      passwordHash: staffPasswordHash,
      role: Role.SCHOOL_MANAGEMENT,
      status: UserStatus.ACTIVE,
    },
  })

  await prisma.user.upsert({
    where: {
      id: ids.eoe,
    },

    update: {
      firstName: 'Paula',
      lastName: 'Ríos',
      email: 'eoe@notar.local',
      role: Role.EOE_DIRECTIVE,
      status: UserStatus.ACTIVE,
      passwordHash: staffPasswordHash,
    },

    create: {
      id: ids.eoe,
      firstName: 'Paula',
      lastName: 'Ríos',
      email: 'eoe@notar.local',
      passwordHash: staffPasswordHash,
      role: Role.EOE_DIRECTIVE,
      status: UserStatus.ACTIVE,
    },
  })

  await prisma.user.upsert({
    where: {
      email: 'admin@notar.local',
    },

    update: {
      firstName: 'Admin',
      lastName: 'Notar',
      role: Role.ADMINISTRATOR,
      status: UserStatus.ACTIVE,
      passwordHash: adminPasswordHash,
    },

    create: {
      firstName: 'Admin',
      lastName: 'Notar',
      email: 'admin@notar.local',
      passwordHash: adminPasswordHash,
      role: Role.ADMINISTRATOR,
      status: UserStatus.ACTIVE,
    },
  })

  // ============================================================
  // 3. Materias
  // ============================================================

  const matematica = await prisma.subject.upsert({
    where: {
      code: 'MAT-TEST',
    },

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
    where: {
      code: 'LEN-TEST',
    },

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

  const historia = await prisma.subject.upsert({
    where: {
      code: 'HIS-TEST',
    },

    update: {},

    create: {
      id: '00000000-0000-0000-0000-000000000202',
      name: 'Historia',
      code: 'HIS-TEST',
      hoursPerWeek: 3,
      gradeLevel: 3,
      area: 'Ciencias Sociales',
    },
  })

  const biologia = await prisma.subject.upsert({
    where: {
      code: 'BIO-TEST',
    },

    update: {},

    create: {
      id: '00000000-0000-0000-0000-000000000203',
      name: 'Biología',
      code: 'BIO-TEST',
      hoursPerWeek: 3,
      gradeLevel: 4,
      area: 'Ciencias Naturales',
    },
  })

  // ============================================================
  // 4. Secciones
  // ============================================================

  const sections = [
    {
      id: ids.sections[0],
      grade: 3,
      division: 'A',
      shift: Shift.MORNING,
      orientation: Orientation.ORIENTED,
    },
    {
      id: ids.sections[1],
      grade: 2,
      division: 'B',
      shift: Shift.AFTERNOON,
      orientation: Orientation.ORIENTED,
    },
    {
      id: ids.sections[2],
      grade: 4,
      division: 'A',
      shift: Shift.MORNING,
      orientation: Orientation.ORIENTED,
    },
  ]

  for (const section of sections) {
    await prisma.classSection.upsert({
      where: {
        id: section.id,
      },

      update: {
        grade: section.grade,
        division: section.division,
        shift: section.shift,
        orientation: section.orientation,
      },

      create: {
        id: section.id,
        grade: section.grade,
        division: section.division,
        shift: section.shift,
        orientation: section.orientation,

        academicYear: {
          connect: {
            id: academicYear.id,
          },
        },
      },
    })
  }

  // ============================================================
  // Sección específica 1° A Mañana
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
        orientation: Orientation.ORIENTED,
        academicYearId: academicYear.id,
      },
    })
  }

  /*
   * IMPORTANTE:
   * Guardamos el ID después de garantizar que section1A existe.
   * Esto evita el error:
   *
   * 'section1A' is possibly 'null'
   */

  const section1AId: string = section1A.id

  // ============================================================
  // 5. Calendario Académico e Asignaciones Docentes
  // ============================================================

  const milestones = [
    {
      id: '00000000-0000-0000-0000-000000000401',
      type: 'Inicio de clases',
      description:
        'Comienzo del ciclo lectivo con jornada de bienvenida y presentación de acuerdos de convivencia.',
      startDate: new Date('2026-03-02'),
      endDate: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000402',
      type: 'Cierre primer cuatrimestre',
      description:
        'Cierre administrativo y pedagógico del primer cuatrimestre con entrega de informes.',
      startDate: new Date('2026-07-17'),
      endDate: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000403',
      type: 'Receso invernal',
      description: 'Receso escolar de invierno.',
      startDate: new Date('2026-07-20'),
      endDate: new Date('2026-07-31'),
    },
    {
      id: '00000000-0000-0000-0000-000000000404',
      type: 'Intensificación diciembre',
      description:
        'Bloque institucional para recuperación de saberes pendientes y cierre de trayectorias.',
      startDate: new Date('2026-12-09'),
      endDate: new Date('2026-12-18'),
    },
  ]

  for (const milestone of milestones) {
    await prisma.calendarMilestone.upsert({
      where: {
        id: milestone.id,
      },

      update: {
        type: milestone.type,
        description: milestone.description,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
        academicYearId: academicYear.id,
      },

      create: {
        id: milestone.id,
        type: milestone.type,
        description: milestone.description,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
        academicYearId: academicYear.id,
      },
    })
  }

  const teacherAssignments = [
    {
      id: '00000000-0000-0000-0000-000000000501',
      teacherId: teacher.id,
      subjectId: matematica.id,
      classSectionId: section1AId,
    },
    {
      id: '00000000-0000-0000-0000-000000000502',
      teacherId: teacher.id,
      subjectId: lengua.id,
      classSectionId: section1AId,
    },
    {
      id: '00000000-0000-0000-0000-000000000503',
      teacherId: teacher2.id,
      subjectId: historia.id,
      classSectionId: ids.sections[0],
    },
    {
      id: '00000000-0000-0000-0000-000000000504',
      teacherId: teacher2.id,
      subjectId: biologia.id,
      classSectionId: ids.sections[2],
    },
  ]

  for (const assignment of teacherAssignments) {
    await prisma.teacherSubjectCourse.upsert({
      where: {
        id: assignment.id,
      },

      update: {
        teacherId: assignment.teacherId,
        subjectId: assignment.subjectId,
        classSectionId: assignment.classSectionId,
      },

      create: {
        id: assignment.id,
        teacherId: assignment.teacherId,
        subjectId: assignment.subjectId,
        classSectionId: assignment.classSectionId,
      },
    })
  }

  // ============================================================
  // 6. Alumnos Generales
  // ============================================================

  const generalStudents = [
    {
      id: ids.students[0],
      dni: '45111222',
      lastName: 'Pérez',
      firstName: 'Sofía',
      recordNumber: 'LEGAJO-001',
      sectionId: ids.sections[0],
      placeOfBirth: 'Mar del Plata, Buenos Aires',
      city: 'Mar del Plata',
      phone: '223-512-4481',
      hasPPI: false,
      status: StudentStatus.ACTIVE,
    },

    {
      id: ids.students[1],
      dni: '46222333',
      lastName: 'García',
      firstName: 'Mateo',
      recordNumber: 'LEGAJO-002',
      sectionId: ids.sections[0],
      placeOfBirth: 'Mar del Plata, Buenos Aires',
      city: 'Mar del Plata',
      phone: '223-598-2210',
      hasPPI: false,
      status: StudentStatus.ACTIVE,
    },

    {
      id: ids.students[2],
      dni: '47333444',
      lastName: 'Luna',
      firstName: 'Camila',
      recordNumber: 'LEGAJO-003',
      sectionId: ids.sections[0],
      placeOfBirth: 'Balcarce, Buenos Aires',
      city: 'Mar del Plata',
      phone: '223-620-0152',
      hasPPI: true,
      status: StudentStatus.ACTIVE,
    },

    {
      id: ids.students[3],
      dni: '48444555',
      lastName: 'Romero',
      firstName: 'Agustina',
      recordNumber: 'LEGAJO-004',
      sectionId: ids.sections[1],
      placeOfBirth: 'Miramar, Buenos Aires',
      city: 'Miramar',
      phone: '2291-54-7731',
      hasPPI: false,
      status: StudentStatus.ACTIVE,
    },

    {
      id: ids.students[4],
      dni: '49555666',
      lastName: 'Díaz',
      firstName: 'Tomás',
      recordNumber: 'LEGAJO-005',
      sectionId: ids.sections[1],
      placeOfBirth: 'Necochea, Buenos Aires',
      city: 'Miramar',
      phone: '2262-43-1109',
      hasPPI: false,
      status: StudentStatus.CONDITIONAL,
      conditionalUntil: new Date('2026-11-30'),
    },

    {
      id: ids.students[5],
      dni: '50666777',
      lastName: 'Benítez',
      firstName: 'Valentina',
      recordNumber: 'LEGAJO-006',
      sectionId: ids.sections[2],
      placeOfBirth: 'Mar del Plata, Buenos Aires',
      city: 'Mar del Plata',
      phone: '223-410-2297',
      hasPPI: false,
      status: StudentStatus.ACTIVE,
    },
  ]

  for (const student of generalStudents) {
    await prisma.student.upsert({
      where: {
        id: student.id,
      },

      update: {
        dni: student.dni,
        lastName: student.lastName,
        firstName: student.firstName,
        recordNumber: student.recordNumber,
        placeOfBirth: student.placeOfBirth,
        city: student.city,
        phone: student.phone,
        hasPPI: student.hasPPI,
        status: student.status,
        conditionalUntil: student.conditionalUntil ?? null,
      },

      create: {
        id: student.id,
        dni: student.dni,
        lastName: student.lastName,
        firstName: student.firstName,
        recordNumber: student.recordNumber,
        dateOfBirth: new Date('2010-04-12'),
        address: 'Domicilio de prueba 123',
        placeOfBirth: student.placeOfBirth,
        city: student.city,
        phone: student.phone,
        hasPPI: student.hasPPI,
        status: student.status,
        conditionalUntil: student.conditionalUntil,
      },
    })

    const historyId =
      `00000000-0000-0000-0000-0000000${student.id.slice(-5)}`

    await prisma.enrollmentHistory.upsert({
      where: {
        id: historyId,
      },

      update: {
        classSection: {
          connect: {
            id: student.sectionId,
          },
        },

        student: {
          connect: {
            id: student.id,
          },
        },
      },

      create: {
        id: historyId,

        student: {
          connect: {
            id: student.id,
          },
        },

        classSection: {
          connect: {
            id: student.sectionId,
          },
        },
      },
    })
  }

  const guardians = [
    {
      id: ids.guardians[0],
      firstName: 'Laura',
      lastName: 'Pérez',
      dni: '28655123',
      phone: '223-512-4490',
      email: 'laura.perez@familia.local',
      relationship: 'Madre',
      links: [
        { studentId: ids.students[0], isPrimary: true },
        { studentId: ids.students[1], isPrimary: true },
      ],
    },
    {
      id: ids.guardians[1],
      firstName: 'Nicolás',
      lastName: 'García',
      dni: '27984330',
      phone: '223-598-2231',
      email: 'nicolas.garcia@familia.local',
      relationship: 'Padre',
      links: [{ studentId: ids.students[1], isPrimary: false }],
    },
    {
      id: ids.guardians[2],
      firstName: 'Daniela',
      lastName: 'Luna',
      dni: '30122781',
      phone: '223-620-0144',
      email: 'daniela.luna@familia.local',
      relationship: 'Madre',
      links: [{ studentId: ids.students[2], isPrimary: true }],
    },
    {
      id: ids.guardians[3],
      firstName: 'Miriam',
      lastName: 'Romero',
      dni: '29447612',
      phone: '2291-54-7714',
      email: 'miriam.romero@familia.local',
      relationship: 'Tía tutora',
      links: [{ studentId: ids.students[3], isPrimary: true }],
    },
    {
      id: ids.guardians[4],
      firstName: 'Ricardo',
      lastName: 'Díaz',
      dni: '27771145',
      phone: '2262-43-1127',
      email: 'ricardo.diaz@familia.local',
      relationship: 'Padre',
      links: [{ studentId: ids.students[4], isPrimary: true }],
    },
    {
      id: ids.guardians[5],
      firstName: 'Silvina',
      lastName: 'Benítez',
      dni: '28993450',
      phone: '223-410-2289',
      email: 'silvina.benitez@familia.local',
      relationship: 'Madre',
      links: [{ studentId: ids.students[5], isPrimary: true }],
    },
  ]

  for (const guardian of guardians) {
    await prisma.guardian.upsert({
      where: {
        id: guardian.id,
      },

      update: {
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        dni: guardian.dni,
        phone: guardian.phone,
        email: guardian.email,
        relationship: guardian.relationship,
      },

      create: {
        id: guardian.id,
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        dni: guardian.dni,
        phone: guardian.phone,
        email: guardian.email,
        relationship: guardian.relationship,
      },
    })

    for (const link of guardian.links) {
      await prisma.studentGuardian.upsert({
        where: {
          studentId_guardianId: {
            studentId: link.studentId,
            guardianId: guardian.id,
          },
        },

        update: {
          isPrimary: link.isPrimary,
        },

        create: {
          studentId: link.studentId,
          guardianId: guardian.id,
          isPrimary: link.isPrimary,
        },
      })
    }
  }

  // ============================================================
  // 6. Alumnos para Grilla de Calificaciones (1° A)
  // ============================================================

  const gradeStudentsSeed = [
    {
      dni: '50000001',
      lastName: 'Acosta',
      firstName: 'María',
    },
    {
      dni: '50000002',
      lastName: 'Benítez',
      firstName: 'Juan',
    },
    {
      dni: '50000003',
      lastName: 'Castro',
      firstName: 'Lucía',
    },
    {
      dni: '50000004',
      lastName: 'Díaz',
      firstName: 'Mateo',
    },
    {
      dni: '50000005',
      lastName: 'Fernández',
      firstName: 'Sofía',
    },
    {
      dni: '50000006',
      lastName: 'Gómez',
      firstName: 'Tomás',
    },
    {
      dni: '50000007',
      lastName: 'Herrera',
      firstName: 'Valentina',
    },
    {
      dni: '50000008',
      lastName: 'Ibáñez',
      firstName: 'Lautaro',
    },
  ]

  const gradeStudentsByDni: Record<string, string> = {}

  let idx = 1

  for (const s of gradeStudentsSeed) {
    const student = await prisma.student.upsert({
      where: {
        dni: s.dni,
      },

      update: {
        lastName: s.lastName,
        firstName: s.firstName,
        placeOfBirth: 'Mar del Plata, Buenos Aires',
        city: 'Mar del Plata',
        phone: '223-400-0000',
        status: StudentStatus.ACTIVE,
      },

      create: {
        dni: s.dni,
        lastName: s.lastName,
        firstName: s.firstName,
        dateOfBirth: new Date('2012-03-15'),
        address: 'Calle Falsa 123',
        placeOfBirth: 'Mar del Plata, Buenos Aires',
        city: 'Mar del Plata',
        phone: '223-400-0000',
        recordNumber: `LEG-TEST-${String(idx).padStart(4, '0')}`,
        status: StudentStatus.ACTIVE,
      },
    })

    gradeStudentsByDni[s.dni] = student.id

    const gradeHistoryId =
      `00000000-0000-0000-0000-000000003${String(idx).padStart(3, '0')}`

    await prisma.enrollmentHistory.upsert({
      where: {
        id: gradeHistoryId,
      },

      update: {
        studentId: student.id,
        classSectionId: section1AId,
      },

      create: {
        id: gradeHistoryId,
        studentId: student.id,
        classSectionId: section1AId,
      },
    })

    idx += 1
  }

  // ============================================================
  // Helpers para inscripciones y notas
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
      where: {
        enrollmentId,
      },

      update: data,

      create: {
        enrollmentId,
        ...data,
      },
    })
  }

  // ============================================================
  // Calificaciones: Matemática
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
      throw new Error(
        `No se encontró el estudiante con DNI ${r.dni}`,
      )
    }

    const enrollmentId = await ensureEnrollment(
      studentId,
      matematica.id,
    )

    if (!firstEnrollmentId) {
      firstEnrollmentId = enrollmentId
    }

    if (r.t1 || r.t2) {
      await setGrade(
        enrollmentId,
        r.t1,
        r.t2,
      )
    }
  }

  // ============================================================
  // Calificaciones: Lengua
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
      throw new Error(
        `No se encontró el estudiante con DNI ${r.dni}`,
      )
    }

    const enrollmentId = await ensureEnrollment(
      studentId,
      lengua.id,
    )

    if (r.t1 || r.t2) {
      await setGrade(
        enrollmentId,
        r.t1,
        r.t2,
      )
    }
  }

  // ============================================================
  // 7. Asistencias Diarias de Prueba
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
    const attendanceDate =
      new Date(`${attendance.date}T00:00:00.000Z`)

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
          connect: {
            id: teacher.id,
          },
        },
      },

      create: {
        id: attendance.id,
        value: attendance.value,
        justification: attendance.justification,
        justified: attendance.justified,
        date: attendanceDate,

        student: {
          connect: {
            id: attendance.studentId,
          },
        },

        section: {
          connect: {
            id: attendance.sectionId,
          },
        },

        registeredBy: {
          connect: {
            id: teacher.id,
          },
        },
      },
    })
  }

  // ============================================================
  // 8. Comunicaciones institucionales
  // ============================================================

  const messages = [
    {
      id: '00000000-0000-0000-0000-000000002801',
      senderId: schoolManagement.id,
      studentId: ids.students[0],
      body:
        'Se recuerda que la reunión de familias de 3° A será el jueves 24/09 a las 18:00 en el SUM.',
      readByFamily: true,
    },
    {
      id: '00000000-0000-0000-0000-000000002802',
      senderId: teacher.id,
      studentId: ids.students[2],
      body:
        'Camila mejoró su participación en clase. Sugerimos sostener rutinas de estudio para el cierre del cuatrimestre.',
      readByFamily: false,
    },
    {
      id: '00000000-0000-0000-0000-000000002803',
      senderId: teacher2.id,
      studentId: ids.students[5],
      body:
        'Se envía propuesta de actividades de apoyo para Biología. Traer carpeta y material de laboratorio el próximo martes.',
      readByFamily: false,
    },
  ]

  for (const message of messages) {
    await prisma.message.upsert({
      where: {
        id: message.id,
      },

      update: {
        senderId: message.senderId,
        studentId: message.studentId,
        body: message.body,
        readByFamily: message.readByFamily,
      },

      create: {
        id: message.id,
        senderId: message.senderId,
        studentId: message.studentId,
        body: message.body,
        readByFamily: message.readByFamily,
      },
    })
  }

  // ============================================================
  // 9. Alertas / Notificaciones
  // ============================================================

  const alertDefinitions = [
    {
      id: '00000000-0000-0000-0000-000000002001',
      studentId: ids.students[0],
      type: AlertType.HEALTH,
      read: false,
      message:
        'Se reportó ausencia por enfermedad con certificado médico vigente.',
    },

    {
      id: '00000000-0000-0000-0000-000000002002',
      studentId: ids.students[1],
      type: AlertType.CONDUCT,
      read: true,
      message:
        'Se registró falta de respeto en clase y se requiere seguimiento de convivencia.',
    },

    {
      id: '00000000-0000-0000-0000-000000002003',
      studentId: ids.students[3],
      type: AlertType.HEALTH,
      read: false,
      message:
        'El estudiante presenta tratamiento médico y requiere apoyo pedagógico.',
    },

    {
      id: '00000000-0000-0000-0000-000000002004',
      studentId: ids.students[4],
      type: AlertType.CONDUCT,
      read: false,
      message:
        'Se evidenció conducta disruptiva durante la jornada escolar y se citó a entrevista.',
    },

    {
      id: '00000000-0000-0000-0000-000000002005',
      studentId: ids.students[2],
      type: AlertType.PENDING_SUBJECTS,
      severity: AlertSeverity.HIGH,
      read: false,
      message:
        'Rendimiento bajo en Matemática: promedio actual 3,5. Se recomienda acordar actividades de apoyo y revisar avances en el próximo período.',
    },

    {
      id: '00000000-0000-0000-0000-000000002006',
      studentId: ids.students[5],
      type: AlertType.PENDING_SUBJECTS,
      severity: AlertSeverity.HIGH,
      read: true,
      message:
        'Presenta calificaciones inferiores a 4 en Matemática y Prácticas del Lenguaje. Requiere seguimiento y acompañamiento pedagógico.',
    },
  ]

  for (const alert of alertDefinitions) {
    await prisma.notification.upsert({
      where: {
        id: alert.id,
      },

      update: {
        type: alert.type,
        severity:
          alert.severity ?? AlertSeverity.MEDIUM,
        message: alert.message,
        read: alert.read ?? false,
        academicYearId: academicYear.id,
      },

      create: {
        id: alert.id,

        student: {
          connect: {
            id: alert.studentId,
          },
        },

        type: alert.type,
        severity:
          alert.severity ?? AlertSeverity.MEDIUM,
        message: alert.message,
        read: alert.read ?? false,
        academicYearId: academicYear.id,
      },
    })
  }

  // ============================================================
  // Finalización
  // ============================================================

  console.log('✅ Datos de prueba creados correctamente.')

  console.log(
    `👉 1° A cargado con ${gradeStudentsSeed.length} alumnos para la grilla (Matemática y Lengua).`,
  )

  console.log(
    '👉 Se incorporaron alertas de salud, conducta y bajo rendimiento.',
  )

  console.log(
    '👉 Primer enrollmentId de prueba:',
    firstEnrollmentId,
  )
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