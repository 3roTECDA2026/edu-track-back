// ─────────────────────────────────────────────────────────────────────
// Script de PRUEBA (solo desarrollo) — NO forma parte del ticket ni del commit.
// Crea datos mínimos para poder probar el POST de calificaciones.
// Se corre a mano:  npx tsx prisma/seed-test.ts
// Es idempotente: se puede correr varias veces sin duplicar.
// ─────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Ciclo lectivo 2026
  const academicYear = await prisma.academicYear.upsert({
    where: { year: 2026 },
    update: {},
    create: { year: 2026, active: true },
  })

  // Materia
  const subject = await prisma.subject.upsert({
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

  // División / curso (1° A, turno mañana)
  let classSection = await prisma.classSection.findFirst({
    where: { grade: 1, division: 'A', shift: 'MORNING', academicYearId: academicYear.id },
  })
  if (!classSection) {
    classSection = await prisma.classSection.create({
      data: { grade: 1, division: 'A', shift: 'MORNING', academicYearId: academicYear.id },
    })
  }

  // Alumno
  const student = await prisma.student.upsert({
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

  // Inscripción del alumno a la materia (a esta se le carga la nota)
  let enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      subjectId: subject.id,
      academicYearId: academicYear.id,
      courseType: 'FIRST_TIME',
    },
  })
  if (!enrollment) {
    enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        subjectId: subject.id,
        classSectionId: classSection.id,
        academicYearId: academicYear.id,
      },
    })
  }

  console.log('\n✅ Datos de prueba listos.')
  console.log('👉 enrollmentId para probar el POST:', enrollment.id, '\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
  })
