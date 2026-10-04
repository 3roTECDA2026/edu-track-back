// ─────────────────────────────────────────────────────────────────────
// Seed de DESARROLLO — datos de prueba para la grilla de calificaciones.
// No corre solo: se ejecuta a mano para poblar tu base local.
//   npx tsx prisma/seed-test.ts
// Carga 1° A (ciclo 2026) con alumnos inscriptos en Matemática y Lengua,
// con notas variadas. Idempotente: se puede correr varias veces sin duplicar.
// ─────────────────────────────────────────────────────────────────────
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Scores = (number | null)[]

async function main() {
  const academicYear = await prisma.academicYear.upsert({
    where: { year: 2026 },
    update: {},
    create: { year: 2026, active: true },
  })

  
  const matematica = await prisma.subject.upsert({
    where: { code: 'MAT-TEST' },
    update: {},
    create: {
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
      name: 'Lengua',
      code: 'LEN-TEST',
      hoursPerWeek: 4,
      gradeLevel: 1,
      area: 'Ciencias Sociales y Humanidades',
    },
  })

  
  let classSection = await prisma.classSection.findFirst({
    where: { grade: 1, division: 'A', shift: 'MORNING', academicYearId: academicYear.id },
  })
  if (!classSection) {
    classSection = await prisma.classSection.create({
      data: { grade: 1, division: 'A', shift: 'MORNING', academicYearId: academicYear.id },
    })
  }

  
  const studentsSeed = [
    { dni: '50000001', lastName: 'Acosta', firstName: 'María' },
    { dni: '50000002', lastName: 'Benítez', firstName: 'Juan' },
    { dni: '50000003', lastName: 'Castro', firstName: 'Lucía' },
    { dni: '50000004', lastName: 'Díaz', firstName: 'Mateo' },
    { dni: '50000005', lastName: 'Fernández', firstName: 'Sofía' },
    { dni: '50000006', lastName: 'Gómez', firstName: 'Tomás' },
    { dni: '50000007', lastName: 'Herrera', firstName: 'Valentina' },
    { dni: '50000008', lastName: 'Ibáñez', firstName: 'Lautaro' },
  ]

  const studentsByDni: Record<string, string> = {}
  let i = 1
  for (const s of studentsSeed) {
    const student = await prisma.student.upsert({
      where: { dni: s.dni },
      update: {},
      create: {
        dni: s.dni,
        lastName: s.lastName,
        firstName: s.firstName,
        dateOfBirth: new Date('2012-03-15'),
        address: 'Calle Falsa 123',
        recordNumber: `LEG-TEST-${String(i).padStart(4, '0')}`,
      },
    })
    studentsByDni[s.dni] = student.id
    i += 1
  }

  
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
          classSectionId: classSection!.id,
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

  
  const mat: Array<{ dni: string; t1?: Scores; t2?: Scores }> = [
    { dni: '50000001', t1: [8, 7, null, 9], t2: [10, null, 6, 7] }, // Acosta
    { dni: '50000002', t1: [6, 6, 7, 5], t2: [7, 6, 6, 8] },        // Benítez
    { dni: '50000003', t1: [9, 10, 9, 8], t2: [10, 9, 10, 9] },     // Castro
    { dni: '50000004', t1: [3, 4, 2, 5], t2: [4, 5, null, 4] },     // Díaz (rojo)
    { dni: '50000005', t1: [7, 8, null, null] },                    // Fernández (2° sin cargar)
    { dni: '50000006' },                                            // Gómez (sin nota)
    { dni: '50000007', t1: [5, 6, 6, 7], t2: [6, 7, 7, 6] },        // Herrera
    { dni: '50000008' },                                            // Ibáñez (sin nota)
  ]
  for (const r of mat) {
    const enrollmentId = await ensureEnrollment(studentsByDni[r.dni], matematica.id)
    if (r.t1 || r.t2) await setGrade(enrollmentId, r.t1, r.t2)
  }

  
  const len: Array<{ dni: string; t1?: Scores; t2?: Scores }> = [
    { dni: '50000001', t1: [9, 8, 8, 7], t2: [8, 9, 8, 9] },  // Acosta
    { dni: '50000002', t1: [6, 5, 6, 6], t2: [7, 6, 5, 6] },  // Benítez
    { dni: '50000003', t1: [10, 9, 9, 10], t2: [9, 10, 10, 9] }, // Castro
    { dni: '50000004', t1: [4, 3, 5, 4] },                    // Díaz (2° sin cargar)
    { dni: '50000005' },                                      // Fernández (sin nota)
  ]
  for (const r of len) {
    const enrollmentId = await ensureEnrollment(studentsByDni[r.dni], lengua.id)
    if (r.t1 || r.t2) await setGrade(enrollmentId, r.t1, r.t2)
  }

  console.log('\n✅ Datos de prueba cargados: 1° A (mañana), ciclo 2026.')
  console.log(`   Alumnos: ${studentsSeed.length}`)
  console.log('   Matemática: 8 inscriptos (6 con nota, 2 sin cargar)')
  console.log('   Lengua: 5 inscriptos (4 con nota, 1 sin cargar)')
  console.log('\n👉 Probá la grilla en: 1° Año / A / Matemática (o Lengua) / 2026\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    
  })