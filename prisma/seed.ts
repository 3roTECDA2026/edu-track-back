import process from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  AlertSeverity,
  AlertType,
  AttendanceValue,
  CourseType,
  IntensificationModel,
  IntensificationPeriod,
  IntensificationResultCode,
  Orientation,
  Prisma,
  PrismaClient,
  Role,
  Shift,
  StudentStatus,
  SubjectStatus,
  UserStatus,
} from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const SALT_ROUNDS = 10

type Scores = (number | null)[]

// UUIDs fijos para la base de pruebas de Notar
const ids = {
  academicYear: '00000000-0000-0000-0000-000000000001',
  // Ciclo 2025, ya terminado, para probar el cierre del ciclo (CRM-052)
  closableYear: '00000000-0000-0000-0000-000000000002',
  closableSection: '00000000-0000-0000-0000-000000000023', // 2° A Mañana 2025
  closableSchedules: {
    december: '00000000-0000-0000-0000-000000005101',
    februaryMarch: '00000000-0000-0000-0000-000000005102',
  },
  // Marzo y julio de 2026, para las MPAA de 2025 en el RITE 2026 (CRM-044)
  mpaaSchedules2026: {
    march: '00000000-0000-0000-0000-000000005103',
    july: '00000000-0000-0000-0000-000000005104',
  },
  closableEnrollments: [
    '00000000-0000-0000-0000-000000005201', // Matemática: aprobada (7 y 8)
    '00000000-0000-0000-0000-000000005202', // Lengua: desaprobada
    '00000000-0000-0000-0000-000000005203', // Historia: aprobada con AA en febrero
    '00000000-0000-0000-0000-000000005204', // Biología (recursada): desaprobada
  ],
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
      email: 'preceptor@notar.local',
    },

    update: {
      firstName: 'Lucía',
      lastName: 'Fernández',
      role: Role.PRECEPTOR,
      status: UserStatus.ACTIVE,
      passwordHash: staffPasswordHash,
    },

    create: {
      firstName: 'Lucía',
      lastName: 'Fernández',
      email: 'preceptor@notar.local',
      passwordHash: staffPasswordHash,
      role: Role.PRECEPTOR,
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
  // Dashboard del EDTE (CRM-077)
  // ============================================================
  // Valoraciones de los dos cuatrimestres de 2026 en 1° A (Matemática y Lengua) y MPAA de 2025:
  // - Díaz: 2 TED (rojo); Fernández: 1 TED (ámbar); Benítez: TEP (ámbar); el resto, TEA.
  // - Castro: 4 MPAA (alerta temprana); Mateo García: 5 MPAA (derivado al EDTE).
  // Las MPAA se cargan directo, sin el cierre del ciclo. El ciclo 2025, la sección 2° A,
  // Geografía y las cursadas de Mateo usan los mismos ids que los seeds de CRM-052, CRM-075 y
  // CRM-078, para que convivan. Los enums van como texto para no tocar la lista de imports.

  type DashAssessment = 'TEA' | 'TEP' | 'TED'
  const dashAssessments: Array<{ dni: string; math: DashAssessment; language: DashAssessment }> = [
    { dni: '50000001', math: 'TEA', language: 'TEA' },
    { dni: '50000002', math: 'TEP', language: 'TEA' },
    { dni: '50000003', math: 'TEA', language: 'TEA' },
    { dni: '50000004', math: 'TED', language: 'TED' },
    { dni: '50000005', math: 'TEP', language: 'TED' },
    { dni: '50000007', math: 'TEA', language: 'TEP' },
  ]

  for (const item of dashAssessments) {
    const studentId = gradeStudentsByDni[item.dni]
    if (!studentId) continue
    for (const [subjectId, value] of [
      [matematica.id, item.math],
      [lengua.id, item.language],
    ] as const) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, subjectId, academicYearId: academicYear.id },
        select: { id: true },
      })
      if (!enrollment) continue
      await prisma.grade.upsert({
        where: { enrollmentId: enrollment.id },
        update: { preliminaryAssessment1: value, preliminaryAssessment2: value },
        create: {
          enrollmentId: enrollment.id,
          preliminaryAssessment1: value,
          preliminaryAssessment2: value,
        },
      })
    }
  }

  const dashYear2025 = await prisma.academicYear.upsert({
    where: { year: 2025 },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      year: 2025,
      active: false,
      term1StartDate: new Date('2025-03-05'),
      term1EndDate: new Date('2025-07-18'),
      term2StartDate: new Date('2025-08-04'),
      term2EndDate: new Date('2025-12-05'),
    },
  })
  const dashSection2025 = '00000000-0000-0000-0000-000000000023' // 2° A Mañana 2025
  await prisma.classSection.upsert({
    where: { id: dashSection2025 },
    update: {},
    create: {
      id: dashSection2025,
      grade: 2,
      division: 'A',
      shift: 'MORNING',
      orientation: 'ORIENTED',
      academicYearId: dashYear2025.id,
    },
  })
  const dashGeography = await prisma.subject.upsert({
    where: { code: 'GEO-TEST' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000204',
      name: 'Geografía',
      code: 'GEO-TEST',
      hoursPerWeek: 3,
      gradeLevel: 2,
      area: 'Ciencias Sociales',
    },
  })

  const dashCastroId = gradeStudentsByDni['50000003']
  const dashPending: Array<{ enrollmentId: string; studentId: string | undefined; subjectId: string }> = [
    // Mateo García: 5 MPAA (mismas cursadas que los seeds de CRM-075 y CRM-078)
    { enrollmentId: '00000000-0000-0000-0000-000000005301', studentId: ids.students[1], subjectId: matematica.id },
    { enrollmentId: '00000000-0000-0000-0000-000000005302', studentId: ids.students[1], subjectId: lengua.id },
    { enrollmentId: '00000000-0000-0000-0000-000000005303', studentId: ids.students[1], subjectId: historia.id },
    { enrollmentId: '00000000-0000-0000-0000-000000005304', studentId: ids.students[1], subjectId: biologia.id },
    { enrollmentId: '00000000-0000-0000-0000-000000005305', studentId: ids.students[1], subjectId: dashGeography.id },
    // Castro: 4 MPAA
    { enrollmentId: '00000000-0000-0000-0000-000000005501', studentId: dashCastroId, subjectId: matematica.id },
    { enrollmentId: '00000000-0000-0000-0000-000000005502', studentId: dashCastroId, subjectId: lengua.id },
    { enrollmentId: '00000000-0000-0000-0000-000000005503', studentId: dashCastroId, subjectId: historia.id },
    { enrollmentId: '00000000-0000-0000-0000-000000005504', studentId: dashCastroId, subjectId: biologia.id },
  ]

  for (const { enrollmentId, studentId, subjectId } of dashPending) {
    if (!studentId) continue
    await prisma.enrollment.upsert({
      where: { id: enrollmentId },
      update: {},
      create: {
        id: enrollmentId,
        studentId,
        subjectId,
        classSectionId: dashSection2025,
        academicYearId: dashYear2025.id,
        courseType: 'FIRST_TIME',
        subjectStatus: 'MPAA',
      },
    })
    await prisma.grade.upsert({
      where: { enrollmentId },
      update: {},
      create: { enrollmentId, term1Score: 3, term2Score: 3, subjectStatus: 'MPAA' },
    })
    await prisma.pendingSubject.upsert({
      where: { originEnrollmentId: enrollmentId },
      update: {},
      create: {
        studentId,
        subjectId,
        originEnrollmentId: enrollmentId,
        originAcademicYearId: dashYear2025.id,
        status: 'PENDING',
        initialPendingKnowledge: 'Saberes del año sin acreditar.',
      },
    })
  }

  console.log('👉 Dashboard del EDTE (CRM-077): GET /api/edte-dashboard')

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
  // Reuniones del EDTE (CRM-075)
  // ============================================================
  // Mateo García desaprobó 5 materias en 2025 y quedó con 5 MPAA: está derivado al EDTE y se lo
  // trata en la reunión de febrero/marzo de 2026.
  // Las MPAA se cargan directo (sin el cierre del ciclo), así este seed no depende de CRM-052.
  // El ciclo 2025 y la sección 2° A usan los mismos ids y datos que el seed de CRM-052, para que
  // los dos convivan; cuando corra el cierre, estas materias ya tienen MPAA y no se duplican.
  // Los enums van como texto para no tocar la lista de imports compartida.

  const referralIds = {
    year2025: '00000000-0000-0000-0000-000000000002',
    section2025: '00000000-0000-0000-0000-000000000023', // 2° A Mañana 2025
    geography: '00000000-0000-0000-0000-000000000204',
    enrollments: [
      '00000000-0000-0000-0000-000000005301',
      '00000000-0000-0000-0000-000000005302',
      '00000000-0000-0000-0000-000000005303',
      '00000000-0000-0000-0000-000000005304',
      '00000000-0000-0000-0000-000000005305',
    ],
    meeting: '00000000-0000-0000-0000-000000005401', // Reunión de febrero/marzo de 2026
  }

  const year2025 = await prisma.academicYear.upsert({
    where: { year: 2025 },
    update: {},
    create: {
      id: referralIds.year2025,
      year: 2025,
      active: false,
      term1StartDate: new Date('2025-03-05'),
      term1EndDate: new Date('2025-07-18'),
      term2StartDate: new Date('2025-08-04'),
      term2EndDate: new Date('2025-12-05'),
    },
  })

  await prisma.classSection.upsert({
    where: { id: referralIds.section2025 },
    update: {},
    create: {
      id: referralIds.section2025,
      grade: 2,
      division: 'A',
      shift: 'MORNING',
      orientation: 'ORIENTED',
      academicYearId: year2025.id,
    },
  })

  const geografia = await prisma.subject.upsert({
    where: { code: 'GEO-TEST' },
    update: {},
    create: {
      id: referralIds.geography,
      name: 'Geografía',
      code: 'GEO-TEST',
      hoursPerWeek: 3,
      gradeLevel: 2,
      area: 'Ciencias Sociales',
    },
  })

  const referredStudentId = ids.students[1]
  const [math, language, history, biology, geography] = referralIds.enrollments
  const referredSubjects = [
    { enrollmentId: math, subjectId: matematica.id },
    { enrollmentId: language, subjectId: lengua.id },
    { enrollmentId: history, subjectId: historia.id },
    { enrollmentId: biology, subjectId: biologia.id },
    { enrollmentId: geography, subjectId: geografia.id },
  ]

  for (const { enrollmentId, subjectId } of referredSubjects) {
    if (!enrollmentId) continue
    await prisma.enrollment.upsert({
      where: { id: enrollmentId },
      update: {},
      create: {
        id: enrollmentId,
        studentId: referredStudentId,
        subjectId,
        classSectionId: referralIds.section2025,
        academicYearId: year2025.id,
        courseType: 'FIRST_TIME',
        subjectStatus: 'MPAA',
      },
    })
    await prisma.grade.upsert({
      where: { enrollmentId },
      update: {},
      create: { enrollmentId, term1Score: 3, term2Score: 3, subjectStatus: 'MPAA' },
    })
    await prisma.pendingSubject.upsert({
      where: { originEnrollmentId: enrollmentId },
      update: {},
      create: {
        studentId: referredStudentId,
        subjectId,
        originEnrollmentId: enrollmentId,
        originAcademicYearId: year2025.id,
        status: 'PENDING',
        initialPendingKnowledge: 'Saberes del año sin acreditar.',
      },
    })
  }

  // Reunión de febrero/marzo de 2026, en borrador: arma los PATE del ciclo 2026
  await prisma.edteMeeting.upsert({
    where: { id: referralIds.meeting },
    update: {},
    create: {
      id: referralIds.meeting,
      academicYearId: academicYear.id,
      date: new Date('2026-03-02T00:00:00.000Z'),
      period: 'FEBRUARY_MARCH',
      shift: 'MORNING',
      status: 'DRAFT',
      considerations: 'Análisis de los estudiantes con 5 o más materias pendientes.',
      createdById: ids.schoolManagement,
      members: {
        create: [
          { userId: ids.schoolManagement, present: true, roleInMeeting: 'SCHOOL_MANAGEMENT' },
          { userId: ids.eoe, present: true, roleInMeeting: 'EOE_DIRECTIVE' },
          { userId: teacher.id, present: false, roleInMeeting: 'TEACHER' },
        ],
      },
      students: {
        create: [{ studentId: referredStudentId, notes: 'Cinco materias pendientes de 2025.' }],
      },
    },
  })

  console.log(
    `👉 Reunión del EDTE de febrero/marzo de 2026 (CRM-075): GET /api/edte-meetings/${referralIds.meeting}`,
  )

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
        studentId: alert.studentId,
        academicYearId: academicYear.id,
        type: alert.type,
        severity: alert.severity ?? AlertSeverity.MEDIUM,
        message: alert.message,
        read: alert.read ?? false,
      },
    })
  }

  // ============================================================
  // 10. Ciclo 2025 terminado, para probar el cierre del ciclo (CRM-052)
  // ============================================================
  // Sofía Pérez cursó 2° A en 2025. Sus períodos de diciembre y febrero/marzo ya terminaron,
  // así que el ciclo se puede cerrar con POST /api/cycle-closure/<id del ciclo 2025>.

  const closableYear = await prisma.academicYear.upsert({
    where: { year: 2025 },
    update: {},
    create: {
      id: ids.closableYear,
      year: 2025,
      active: false,
      term1StartDate: new Date('2025-03-05'),
      term1EndDate: new Date('2025-07-18'),
      term2StartDate: new Date('2025-08-04'),
      term2EndDate: new Date('2025-12-05'),
    },
  })

  await prisma.classSection.upsert({
    where: { id: ids.closableSection },
    update: {},
    create: {
      id: ids.closableSection,
      grade: 2,
      division: 'A',
      shift: Shift.MORNING,
      orientation: Orientation.ORIENTED,
      academicYearId: closableYear.id,
    },
  })

  const closableSchedules = [
    {
      id: ids.closableSchedules.december,
      period: IntensificationPeriod.DECEMBER,
      startDate: new Date('2025-12-09T00:00:00.000Z'),
      endDate: new Date('2025-12-22T00:00:00.000Z'),
    },
    {
      id: ids.closableSchedules.februaryMarch,
      period: IntensificationPeriod.FEBRUARY_MARCH,
      startDate: new Date('2026-02-18T00:00:00.000Z'),
      endDate: new Date('2026-03-06T00:00:00.000Z'),
    },
  ]

  for (const schedule of closableSchedules) {
    await prisma.intensificationSchedule.upsert({
      where: {
        academicYearId_period: { academicYearId: closableYear.id, period: schedule.period },
      },
      update: {},
      create: { ...schedule, academicYearId: closableYear.id },
    })
  }

  const closableStudentId = ids.students[0]

  type ClosableAttempt = {
    period: IntensificationPeriod
    resultCode: IntensificationResultCode
    score: number | null
    pendingKnowledge?: string
  }

  const closableSubjects: Array<{
    enrollmentId: string
    subjectId: string
    courseType: CourseType
    term1Score: number
    term2Score: number
    rationale2?: string
    attempts: ClosableAttempt[]
    // Como lo deja la carga de un AA (CRM-058) antes del ajuste: solo en Grade
    accredited?: number
  }> = [
    {
      enrollmentId: ids.closableEnrollments[0],
      subjectId: matematica.id,
      courseType: CourseType.FIRST_TIME,
      term1Score: 7,
      term2Score: 8,
      attempts: [],
    },
    {
      enrollmentId: ids.closableEnrollments[1],
      subjectId: lengua.id,
      courseType: CourseType.FIRST_TIME,
      term1Score: 6,
      term2Score: 5,
      rationale2: 'Producción de textos argumentativos.',
      attempts: [
        {
          period: IntensificationPeriod.DECEMBER,
          resultCode: IntensificationResultCode.CCA,
          score: null,
          pendingKnowledge: 'Producción de textos argumentativos y uso de conectores.',
        },
        {
          period: IntensificationPeriod.FEBRUARY_MARCH,
          resultCode: IntensificationResultCode.CSA,
          score: null,
          pendingKnowledge: 'Uso de conectores en textos argumentativos.',
        },
      ],
    },
    {
      enrollmentId: ids.closableEnrollments[2],
      subjectId: historia.id,
      courseType: CourseType.FIRST_TIME,
      term1Score: 5,
      term2Score: 6,
      attempts: [
        {
          period: IntensificationPeriod.DECEMBER,
          resultCode: IntensificationResultCode.CCA,
          score: null,
          pendingKnowledge: 'Procesos de independencia en América Latina.',
        },
        {
          period: IntensificationPeriod.FEBRUARY_MARCH,
          resultCode: IntensificationResultCode.AA,
          score: 6,
        },
      ],
      accredited: 6,
    },
    {
      enrollmentId: ids.closableEnrollments[3],
      subjectId: biologia.id,
      courseType: CourseType.REPEAT,
      term1Score: 4,
      term2Score: 3,
      rationale2: 'Célula y funciones vitales.',
      attempts: [
        {
          period: IntensificationPeriod.DECEMBER,
          resultCode: IntensificationResultCode.CSA,
          score: null,
          pendingKnowledge: 'Célula: estructura y funciones.',
        },
        {
          period: IntensificationPeriod.FEBRUARY_MARCH,
          resultCode: IntensificationResultCode.CSA,
          score: null,
        },
      ],
    },
  ]

  for (const item of closableSubjects) {
    // update vacío: si el seed se vuelve a correr después del cierre, no se pisa lo que hizo el cierre
    await prisma.enrollment.upsert({
      where: { id: item.enrollmentId },
      update: {},
      create: {
        id: item.enrollmentId,
        studentId: closableStudentId,
        subjectId: item.subjectId,
        classSectionId: ids.closableSection,
        academicYearId: closableYear.id,
        courseType: item.courseType,
      },
    })

    await prisma.grade.upsert({
      where: { enrollmentId: item.enrollmentId },
      update: {},
      create: {
        enrollmentId: item.enrollmentId,
        term1Score: item.term1Score,
        term2Score: item.term2Score,
        rationale2: item.rationale2,
        ...(item.accredited !== undefined && {
          finalScore: item.accredited,
          subjectStatus: SubjectStatus.APPROVED_ACCREDITED,
        }),
      },
    })

    for (const attempt of item.attempts) {
      const scheduleId =
        attempt.period === IntensificationPeriod.DECEMBER
          ? ids.closableSchedules.december
          : ids.closableSchedules.februaryMarch
      await prisma.intensification.upsert({
        where: { enrollmentId_scheduleId: { enrollmentId: item.enrollmentId, scheduleId } },
        update: {},
        create: {
          enrollmentId: item.enrollmentId,
          scheduleId,
          period: attempt.period,
          model: IntensificationModel.MODEL_1,
          resultCode: attempt.resultCode,
          score: attempt.score,
          pendingKnowledge: attempt.pendingKnowledge,
          responsibleTeacherId: teacher.id,
        },
      })
    }
  }

  // ============================================================
  // 11. MPAA de 2025 intensificadas en 2026, para la tabla del RITE (CRM-044)
  // ============================================================
  // Después de cerrar el ciclo 2025, Lengua y Biología quedan como MPAA de Sofía. Los intentos de
  // 2026 cuelgan de la cursada de 2025, igual que los que carga la asignación (CRM-056).
  // El RITE 2026 de Sofía muestra Lengua acreditada en julio y Biología pendiente.
  // Atajo del seed: el AA de Lengua no pasa por la carga de resultados (CRM-058), así que la MPAA
  // sigue en estado PENDING; el RITE la muestra igual como acreditada en este ciclo.

  const mpaaSchedules2026 = [
    {
      id: ids.mpaaSchedules2026.march,
      period: IntensificationPeriod.MARCH,
      startDate: new Date('2026-03-09T00:00:00.000Z'),
      endDate: new Date('2026-03-20T00:00:00.000Z'),
    },
    {
      id: ids.mpaaSchedules2026.july,
      period: IntensificationPeriod.JULY,
      startDate: new Date('2026-07-06T00:00:00.000Z'),
      endDate: new Date('2026-07-17T00:00:00.000Z'),
    },
  ]

  for (const schedule of mpaaSchedules2026) {
    await prisma.intensificationSchedule.upsert({
      where: {
        academicYearId_period: { academicYearId: academicYear.id, period: schedule.period },
      },
      update: {},
      create: { ...schedule, academicYearId: academicYear.id },
    })
  }

  const mpaaAttempts2026 = [
    {
      enrollmentId: ids.closableEnrollments[1], // Lengua
      scheduleId: ids.mpaaSchedules2026.march,
      period: IntensificationPeriod.MARCH,
      resultCode: IntensificationResultCode.CSA,
      score: null,
      pendingKnowledge: 'Uso de conectores en textos argumentativos.',
    },
    {
      enrollmentId: ids.closableEnrollments[1], // Lengua
      scheduleId: ids.mpaaSchedules2026.july,
      period: IntensificationPeriod.JULY,
      resultCode: IntensificationResultCode.AA,
      score: 6,
      pendingKnowledge: null,
    },
    {
      enrollmentId: ids.closableEnrollments[3], // Biología
      scheduleId: ids.mpaaSchedules2026.march,
      period: IntensificationPeriod.MARCH,
      resultCode: IntensificationResultCode.CCA,
      score: 2,
      pendingKnowledge: 'Funciones de nutrición y relación.',
    },
  ]

  for (const attempt of mpaaAttempts2026) {
    await prisma.intensification.upsert({
      where: {
        enrollmentId_scheduleId: {
          enrollmentId: attempt.enrollmentId,
          scheduleId: attempt.scheduleId,
        },
      },
      update: {},
      create: {
        ...attempt,
        model: IntensificationModel.MODEL_1,
        responsibleTeacherId: teacher.id,
      },
    })
  }

  // ============================================================
  // 12. RITE firmado con el formato anterior (CRM-044)
  // ============================================================
  // Sirve para ver en pantalla cómo se muestra un RITE firmado antes de CRM-044: su copia fija
  // no tiene `pendingSubjects`, ni la nota de recuperación del 1.° cuatrimestre, y guarda
  // diciembre y febrero como un número suelto (no como { score, resultCode }). Tampoco tiene
  // `isPostIntensification` ni los campos opcionales de asistencia.
  // Es el RITE del 2.° cuatrimestre de 2025 de Sofía Pérez. Si ya existe uno, no se pisa.

  const legacyRiteSnapshot = {
    institution: { name: 'Escuela Normal Secundaria', number: '10', district: 'Tandil' },
    academicYear: 2025,
    term: 'SECOND',
    student: {
      id: closableStudentId,
      firstName: 'Sofía',
      lastName: 'Pérez',
      dni: '45111222',
      recordNumber: 'LEG-0001',
    },
    section: { grade: 2, division: 'A', shift: 'MORNING' },
    subjects: [
      {
        enrollmentId: ids.closableEnrollments[0],
        type: 'C',
        subjectName: 'Matemática',
        gradeLevel: 1,
        term1: { preliminaryAssessment: 'TEA', score: 7, observations: null },
        term2: { preliminaryAssessment: 'TEA', score: 8, observations: null },
        intensification: { december: null, february: null },
        finalScore: 8,
      },
      {
        enrollmentId: ids.closableEnrollments[1],
        type: 'C',
        subjectName: 'Lengua',
        gradeLevel: 1,
        term1: { preliminaryAssessment: 'TEP', score: 6, observations: null },
        term2: {
          preliminaryAssessment: 'TEP',
          score: 5,
          observations: 'Producción de textos argumentativos.',
        },
        intensification: { december: 4, february: null },
        finalScore: null,
      },
      {
        enrollmentId: ids.closableEnrollments[2],
        type: 'C',
        subjectName: 'Historia',
        gradeLevel: 3,
        term1: { preliminaryAssessment: 'TEP', score: 5, observations: null },
        term2: { preliminaryAssessment: 'TEP', score: 6, observations: null },
        intensification: { december: null, february: 6 },
        finalScore: 6,
      },
      {
        enrollmentId: ids.closableEnrollments[3],
        type: 'R',
        subjectName: 'Biología',
        gradeLevel: 4,
        term1: { preliminaryAssessment: 'TED', score: 4, observations: null },
        term2: { preliminaryAssessment: 'TED', score: 3, observations: null },
        intensification: { december: null, february: null },
        finalScore: null,
      },
    ],
    attendance: {
      term1: { schoolDays: 90, absences: 3 },
      term2: { schoolDays: 88, absences: 2 },
      totalSchoolDays: 178,
      totalAbsences: 5,
    },
    generalNotes: 'RITE firmado con el formato anterior a CRM-044 (para pruebas).',
    notifications: [
      {
        term: 'SECOND',
        status: 'SIGNED',
        signedAt: '2025-12-10T12:00:00.000Z',
        signedBy: 'Marcela Quiroga',
      },
    ],
  }

  await prisma.rite.upsert({
    where: {
      studentId_academicYearId_term_isPostIntensification: {
        studentId: closableStudentId,
        academicYearId: closableYear.id,
        term: 'SECOND',
        isPostIntensification: false,
      },
    },
    update: {},
    create: {
      studentId: closableStudentId,
      academicYearId: closableYear.id,
      term: 'SECOND',
      isPostIntensification: false,
      status: 'SIGNED',
      generalNotes: legacyRiteSnapshot.generalNotes,
      signedAt: new Date('2025-12-10T12:00:00.000Z'),
      signingAuthorityId: ids.schoolManagement,
      snapshot: legacyRiteSnapshot as Prisma.InputJsonValue,
    },
  })

  console.log(
    '👉 RITE firmado con el formato anterior (CRM-044): Sofía Pérez → RITE → ciclo 2025, 2° cuatrimestre',
  )

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
    `👉 Ciclo 2025 terminado para probar el cierre (CRM-052): POST /api/cycle-closure/${closableYear.id}`,
  )

  console.log(
    '👉 Primer enrollmentId de prueba:',
    firstEnrollmentId,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch(async (e) => {
      console.error('❌ Error ejecutando el seed:', e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}