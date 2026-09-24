import { Router } from 'express';
import { AttendanceValue, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const router = Router();

const dateSchema = z.string().date();
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  studentId: z.string().optional(),
  search: z.string().trim().optional(),
  sectionId: z.string().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  value: z.nativeEnum(AttendanceValue).optional(),
  justified: z.enum(['true', 'false']).transform((item) => item === 'true').optional(),
});

const batchSchema = z.object({
  date: dateSchema,
  sectionId: z.string().min(1),
  registeredById: z.string().min(1),
  records: z.array(z.object({
    studentId: z.string().min(1),
    value: z.nativeEnum(AttendanceValue),
  })).min(1),
});

const justificationSchema = z.object({ justification: z.string().trim().min(1) });

const WEIGHT: Record<AttendanceValue, number> = {
  PRESENT: 0,
  ABSENT: 1,
  HALF: 0.5,
  QUARTER: 0.25,
};

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const buildAttendanceWhere = (
  filters: z.infer<typeof paginationSchema>,
): Prisma.DailyAttendanceWhereInput => ({
  ...(filters.studentId && { studentId: filters.studentId }),
  ...(filters.sectionId && { sectionId: filters.sectionId }),
  ...(filters.search && {
    student: {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { dni: { contains: filters.search } },
      ],
    },
  }),
  ...(filters.value && { value: filters.value }),
  ...(filters.justified !== undefined && { justified: filters.justified }),
  ...((filters.from || filters.to) && {
    date: {
      ...(filters.from && { gte: toDate(filters.from) }),
      ...(filters.to && { lte: toDate(filters.to) }),
    },
  }),
});

router.post('/batch', async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Datos de asistencia inválidos.', errors: parsed.error.flatten() });
    return;
  }

  const { date, sectionId, registeredById, records } = parsed.data;

  try {
    const attendances = await prisma.$transaction(
      records.map((record) => prisma.dailyAttendance.upsert({
        where: { studentId_date_sectionId: { studentId: record.studentId, date: toDate(date), sectionId } },
        create: { ...record, date: toDate(date), sectionId, registeredById },
        update: { value: record.value, registeredById },
      })),
    );
    res.status(201).json(attendances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo registrar la asistencia.' });
  }
});

router.get('/', async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Filtros de asistencia inválidos.', errors: parsed.error.flatten() });
    return;
  }

  const { page, pageSize } = parsed.data;
  const where = buildAttendanceWhere(parsed.data);

  try {
    const [items, total] = await prisma.$transaction([
      prisma.dailyAttendance.findMany({
        where,
        include: { student: true, section: true },
        orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dailyAttendance.count({ where }),
    ]);
    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudieron obtener las asistencias.' });
  }
});

router.patch('/:id/justify', async (req, res) => {
  const parsed = justificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'La justificación es obligatoria.', errors: parsed.error.flatten() });
    return;
  }

  try {
    const attendance = await prisma.dailyAttendance.update({
      where: { id: req.params.id },
      data: { justified: true, justification: parsed.data.justification },
    });
    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(404).json({ message: 'No se encontró la asistencia.' });
  }
});

router.get('/summary', async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Filtros de resumen inválidos.', errors: parsed.error.flatten() });
    return;
  }

  const { page, pageSize } = parsed.data;
  const where = buildAttendanceWhere(parsed.data);

  try {
    const attendances = await prisma.dailyAttendance.findMany({
      where,
      include: { student: true, section: true },
      orderBy: { date: 'desc' },
    });
    const grouped = new Map<string, {
      studentId: string;
      student: string;
      dni: string;
      sectionId: string;
      course: string;
      date: string;
      absences: number;
      halfAbsences: number;
      quarterAbsences: number;
      total: number;
      justified: number;
      unjustified: number;
      justifications: { id: string; date: string; type: 'ausente' | 'media' | 'cuarto'; reason: string }[];
    }>();

    for (const attendance of attendances) {
      const current = grouped.get(attendance.studentId) ?? {
        studentId: attendance.studentId,
        student: `${attendance.student.lastName}, ${attendance.student.firstName}`,
        dni: attendance.student.dni,
        sectionId: attendance.sectionId,
        course: `${attendance.section.grade}° Año Sección ${attendance.section.division}`,
        date: attendance.date.toISOString().slice(0, 10),
        absences: 0,
        halfAbsences: 0,
        quarterAbsences: 0,
        total: 0,
        justified: 0,
        unjustified: 0,
        justifications: [],
      };
      const weight = WEIGHT[attendance.value];
      if (attendance.value === AttendanceValue.ABSENT) current.absences += 1;
      if (attendance.value === AttendanceValue.HALF) current.halfAbsences += 1;
      if (attendance.value === AttendanceValue.QUARTER) current.quarterAbsences += 1;
      current.total += weight;
      if (attendance.justified) current.justified += weight;
      else current.unjustified += weight;
      if (attendance.justified && attendance.justification) {
        const type = attendance.value === AttendanceValue.HALF ? 'media' : attendance.value === AttendanceValue.QUARTER ? 'cuarto' : 'ausente';
        current.justifications.push({ id: attendance.id, date: attendance.date.toISOString().slice(0, 10), type, reason: attendance.justification });
      }
      grouped.set(attendance.studentId, current);
    }

    const items = [...grouped.values()]
      .sort((left, right) => right.total - left.total)
      .slice((page - 1) * pageSize, page * pageSize);
    const total = grouped.size;
    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo obtener el resumen de asistencias.' });
  }
});

export default router;