import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  createGradeSchema,
  updateGradeSchema,
  listGradesQuerySchema,
} from '@/schemas/grade.schema'

// ── GET /api/grades ───────────────────────────────────────────────────
// Lista calificaciones con filtros y paginado. Incluye datos del alumno.
// Filtros (opcionales): classSectionId (división), subjectId (materia),
// year (año lectivo), subjectStatus. Paginado: page, pageSize.
export async function listGrades(req: Request, res: Response) {
  const parsed = listGradesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros de consulta inválidos',
      errors: parsed.error.issues,
    })
  }
  const { page, pageSize, classSectionId, subjectId, year, subjectStatus } = parsed.data

  // La calificación cuelga de la inscripción (enrollment), así que los filtros
  // de curso/materia/año se aplican sobre la inscripción.
  const enrollmentFilter: Prisma.EnrollmentWhereInput = {}
  if (classSectionId) enrollmentFilter.classSectionId = classSectionId
  if (subjectId) enrollmentFilter.subjectId = subjectId
  if (year !== undefined) enrollmentFilter.academicYear = { year }

  const where: Prisma.GradeWhereInput = {}
  if (Object.keys(enrollmentFilter).length > 0) where.enrollment = enrollmentFilter
  if (subjectStatus) where.subjectStatus = subjectStatus

  const skip = (page - 1) * pageSize

  try {
    // count + findMany en paralelo: uno da el total (para el paginado) y el otro la página.
    const [total, data] = await Promise.all([
      prisma.grade.count({ where }),
      prisma.grade.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          enrollment: {
            include: {
              student: { select: { id: true, dni: true, lastName: true, firstName: true } },
              subject: { select: { id: true, name: true } },
              classSection: { select: { id: true, grade: true, division: true } },
              academicYear: { select: { id: true, year: true } },
            },
          },
        },
      }),
    ])

    return res.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Error al listar calificaciones:', error)
    return res.status(500).json({ message: 'Error al listar las calificaciones' })
  }
}

// ── POST /api/grades ──────────────────────────────────────────────────
// Crea la calificación de una inscripción. Si ya existía, la actualiza (upsert),
// porque la calificación es única por inscripción (enrollmentId).
export async function createGrade(req: Request, res: Response) {
  const parsed = createGradeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.issues })
  }
  const { enrollmentId, ...scores } = parsed.data

  // TODO (auth): cuando el login (JWT) esté integrado, validar que el docente
  // autenticado tenga asignada esta materia (TeacherSubjectCourse) antes de cargar.

  try {
    const grade = await prisma.grade.upsert({
      where: { enrollmentId },
      update: scores as Prisma.GradeUpdateInput,
      create: { enrollmentId, ...scores } as Prisma.GradeUncheckedCreateInput,
    })
    return res.status(201).json(grade)
  } catch (error) {
    // P2003: la inscripción (enrollmentId) no existe
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(404).json({ message: 'La inscripción (enrollmentId) no existe' })
    }
    console.error('Error al guardar la calificación:', error)
    return res.status(500).json({ message: 'Error al guardar la calificación' })
  }
}

// ── PUT /api/grades/:id ───────────────────────────────────────────────
// Actualiza una calificación existente por su id.
export async function updateGrade(req: Request, res: Response) {
  const id = req.params.id
  if (!id) return res.status(400).json({ message: 'Falta el id de la calificación' })

  const parsed = updateGradeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.issues })
  }

  // TODO (auth): permitir solo al creador o a un admin cuando el login esté integrado.

  try {
    const grade = await prisma.grade.update({
      where: { id },
      data: parsed.data as Prisma.GradeUpdateInput,
    })
    return res.json(grade)
  } catch (error) {
    // P2025: no se encontró el registro a actualizar
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'No se encontró la calificación' })
    }
    console.error('Error al actualizar la calificación:', error)
    return res.status(500).json({ message: 'Error al actualizar la calificación' })
  }
}

// ── DELETE /api/grades/:id ────────────────────────────────────────────
// Elimina una calificación por su id.
export async function deleteGrade(req: Request, res: Response) {
  const id = req.params.id
  if (!id) return res.status(400).json({ message: 'Falta el id de la calificación' })

  // TODO (auth): permitir solo a un admin cuando el login esté integrado.

  try {
    await prisma.grade.delete({ where: { id } })
    return res.status(204).send()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'No se encontró la calificación' })
    }
    console.error('Error al eliminar la calificación:', error)
    return res.status(500).json({ message: 'Error al eliminar la calificación' })
  }
}
