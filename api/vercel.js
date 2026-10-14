// src/entrypoints/vercel.ts
import "dotenv/config";

// src/app.ts
import "dotenv/config";
import cors from "cors";
import express2 from "express";

// src/middlewares/errorHandler.ts
import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";

// src/utils/httpError.ts
var HttpError = class extends Error {
  status;
  details;
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
};

// src/middlewares/errorHandler.ts
var errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation error", details: z.flattenError(err) });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...err.details !== void 0 ? { details: err.details } : {}
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Resource already exists" });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({ error: "Related resource not found" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

// src/routes/index.ts
import { Router as Router10 } from "express";

// src/routes/teacherAssignment.routes.ts
import { Router } from "express";

// src/utils/asyncHandler.ts
var asyncHandler = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

// src/services/teacherAssignment.service.ts
import { Role } from "@prisma/client";

// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();

// src/services/teacherAssignment.service.ts
var teacherSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true
};
var subjectSummarySelect = {
  id: true,
  name: true,
  code: true,
  hoursPerWeek: true,
  area: true
};
var classSectionSummarySelect = {
  id: true,
  grade: true,
  division: true,
  shift: true,
  academicYear: { select: { id: true, year: true } }
};
var teacherAssignmentSelect = {
  id: true,
  createdAt: true,
  teacherId: true,
  subjectId: true,
  classSectionId: true,
  teacher: { select: teacherSummarySelect },
  subject: { select: subjectSummarySelect },
  classSection: { select: classSectionSummarySelect }
};
function buildAssignmentWhere(query) {
  const where = {};
  if (query.teacherId !== void 0) where.teacherId = query.teacherId;
  if (query.subjectId !== void 0) where.subjectId = query.subjectId;
  if (query.classSectionId !== void 0) where.classSectionId = query.classSectionId;
  return where;
}
async function listTeacherAssignments(query) {
  return await prisma.teacherSubjectCourse.findMany({
    where: buildAssignmentWhere(query),
    select: teacherAssignmentSelect,
    orderBy: [{ createdAt: "desc" }]
  });
}
async function getTeacherAssignment(id) {
  const assignment = await prisma.teacherSubjectCourse.findUnique({
    where: { id },
    select: teacherAssignmentSelect
  });
  if (!assignment) throw new HttpError(404, "Teacher assignment not found");
  return assignment;
}
async function createTeacherAssignment(data) {
  await assertTeacherIsAssignable(data.teacherId);
  return await prisma.teacherSubjectCourse.create({
    data,
    select: teacherAssignmentSelect
  });
}
async function updateTeacherAssignment(id, data) {
  await getTeacherAssignment(id);
  if (data.teacherId !== void 0) {
    await assertTeacherIsAssignable(data.teacherId);
  }
  const changes = {};
  if (data.teacherId !== void 0) changes.teacherId = data.teacherId;
  if (data.subjectId !== void 0) changes.subjectId = data.subjectId;
  if (data.classSectionId !== void 0) changes.classSectionId = data.classSectionId;
  return await prisma.teacherSubjectCourse.update({
    where: { id },
    data: changes,
    select: teacherAssignmentSelect
  });
}
async function deleteTeacherAssignment(id) {
  await getTeacherAssignment(id);
  await prisma.teacherSubjectCourse.delete({ where: { id } });
}
async function assertTeacherIsAssignable(teacherId) {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, role: true, status: true }
  });
  if (!teacher) throw new HttpError(404, "Teacher not found");
  if (teacher.role !== Role.TEACHER) {
    throw new HttpError(409, `El usuario ${teacherId} no tiene rol docente`);
  }
}

// src/schemas/teacherAssignment.schema.ts
import { z as z2 } from "zod";
var createTeacherAssignmentSchema = z2.object({
  teacherId: z2.string().uuid(),
  subjectId: z2.string().uuid(),
  classSectionId: z2.string().uuid()
});
var updateTeacherAssignmentSchema = createTeacherAssignmentSchema.partial();
var teacherAssignmentIdParamSchema = z2.object({
  id: z2.string().uuid()
});
var listTeacherAssignmentsQuerySchema = z2.object({
  teacherId: z2.string().uuid().optional(),
  subjectId: z2.string().uuid().optional(),
  classSectionId: z2.string().uuid().optional()
});

// src/controllers/teacherAssignment.controller.ts
async function listTeacherAssignments2(req, res) {
  const query = listTeacherAssignmentsQuerySchema.parse(req.query);
  res.json(await listTeacherAssignments(query));
}
async function getTeacherAssignment2(req, res) {
  const { id } = teacherAssignmentIdParamSchema.parse(req.params);
  res.json(await getTeacherAssignment(id));
}
async function createTeacherAssignment2(req, res) {
  const data = createTeacherAssignmentSchema.parse(req.body);
  res.status(201).json(await createTeacherAssignment(data));
}
async function updateTeacherAssignment2(req, res) {
  const { id } = teacherAssignmentIdParamSchema.parse(req.params);
  const data = updateTeacherAssignmentSchema.parse(req.body);
  res.json(await updateTeacherAssignment(id, data));
}
async function deleteTeacherAssignment2(req, res) {
  const { id } = teacherAssignmentIdParamSchema.parse(req.params);
  await deleteTeacherAssignment(id);
  res.status(204).send();
}

// src/routes/teacherAssignment.routes.ts
var teacherAssignmentRouter = Router();
teacherAssignmentRouter.get(
  "/",
  asyncHandler(listTeacherAssignments2)
);
teacherAssignmentRouter.post(
  "/",
  asyncHandler(createTeacherAssignment2)
);
teacherAssignmentRouter.get(
  "/:id",
  asyncHandler(getTeacherAssignment2)
);
teacherAssignmentRouter.patch(
  "/:id",
  asyncHandler(updateTeacherAssignment2)
);
teacherAssignmentRouter.delete(
  "/:id",
  asyncHandler(deleteTeacherAssignment2)
);

// src/routes/attendance.routes.ts
import { AttendanceValue, PrismaClient as PrismaClient2 } from "@prisma/client";
import { Router as Router2 } from "express";
import { z as z3 } from "zod";
var prisma2 = new PrismaClient2();
var router = Router2();
var dateSchema = z3.string().date();
var paginationSchema = z3.object({
  page: z3.coerce.number().int().min(1).default(1),
  pageSize: z3.coerce.number().int().min(1).max(100).default(20),
  studentId: z3.string().optional(),
  search: z3.string().trim().optional(),
  sectionId: z3.string().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  value: z3.nativeEnum(AttendanceValue).optional(),
  justified: z3.enum(["true", "false"]).transform((item) => item === "true").optional()
});
var batchSchema = z3.object({
  date: dateSchema,
  sectionId: z3.string().min(1),
  registeredById: z3.string().min(1),
  records: z3.array(
    z3.object({
      studentId: z3.string().min(1),
      value: z3.nativeEnum(AttendanceValue)
    })
  ).min(1)
});
var justificationSchema = z3.object({ justification: z3.string().trim().min(1) });
var WEIGHT = {
  PRESENT: 0,
  ABSENT: 1,
  HALF: 0.5,
  QUARTER: 0.25
};
var toDate = (value) => /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
var buildAttendanceWhere = (filters) => ({
  ...filters.studentId && { studentId: filters.studentId },
  ...filters.sectionId && { sectionId: filters.sectionId },
  ...filters.search && {
    student: {
      OR: [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { dni: { contains: filters.search } }
      ]
    }
  },
  ...filters.value && { value: filters.value },
  ...filters.justified !== void 0 && { justified: filters.justified },
  ...(filters.from || filters.to) && {
    date: {
      ...filters.from && { gte: toDate(filters.from) },
      ...filters.to && { lte: toDate(filters.to) }
    }
  }
});
router.post("/batch", async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Datos de asistencia inv\xE1lidos.", errors: parsed.error.flatten() });
    return;
  }
  const { date, sectionId, registeredById, records } = parsed.data;
  try {
    const attendances = await prisma2.$transaction(
      records.map(
        (record) => prisma2.dailyAttendance.upsert({
          where: {
            studentId_date_sectionId: {
              studentId: record.studentId,
              date: toDate(date),
              sectionId
            }
          },
          create: { ...record, date: toDate(date), sectionId, registeredById },
          update: { value: record.value, registeredById }
        })
      )
    );
    res.status(201).json(attendances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "No se pudo registrar la asistencia." });
  }
});
router.get("/", async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Filtros de asistencia inv\xE1lidos.", errors: parsed.error.flatten() });
    return;
  }
  const { page, pageSize } = parsed.data;
  const where = buildAttendanceWhere(parsed.data);
  try {
    const [items, total] = await prisma2.$transaction([
      prisma2.dailyAttendance.findMany({
        where,
        include: { student: true, section: true },
        orderBy: [{ date: "desc" }, { student: { lastName: "asc" } }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma2.dailyAttendance.count({ where })
    ]);
    res.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "No se pudieron obtener las asistencias." });
  }
});
router.patch("/:id/justify", async (req, res) => {
  const parsed = justificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "La justificaci\xF3n es obligatoria.", errors: parsed.error.flatten() });
    return;
  }
  try {
    const attendance = await prisma2.dailyAttendance.update({
      where: { id: req.params.id },
      data: { justified: true, justification: parsed.data.justification }
    });
    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(404).json({ message: "No se encontr\xF3 la asistencia." });
  }
});
router.get("/summary", async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Filtros de resumen inv\xE1lidos.", errors: parsed.error.flatten() });
    return;
  }
  const { page, pageSize } = parsed.data;
  const where = buildAttendanceWhere(parsed.data);
  try {
    const attendances = await prisma2.dailyAttendance.findMany({
      where,
      include: { student: true, section: true },
      orderBy: { date: "desc" }
    });
    const grouped = /* @__PURE__ */ new Map();
    for (const attendance of attendances) {
      const current = grouped.get(attendance.studentId) ?? {
        studentId: attendance.studentId,
        student: `${attendance.student.lastName}, ${attendance.student.firstName}`,
        dni: attendance.student.dni,
        sectionId: attendance.sectionId,
        course: `${attendance.section.grade}\xB0 A\xF1o Secci\xF3n ${attendance.section.division}`,
        date: attendance.date.toISOString().slice(0, 10),
        absences: 0,
        halfAbsences: 0,
        quarterAbsences: 0,
        total: 0,
        justified: 0,
        unjustified: 0,
        justifications: []
      };
      const weight = WEIGHT[attendance.value];
      if (attendance.value === AttendanceValue.ABSENT) current.absences += 1;
      if (attendance.value === AttendanceValue.HALF) current.halfAbsences += 1;
      if (attendance.value === AttendanceValue.QUARTER) current.quarterAbsences += 1;
      current.total += weight;
      if (attendance.justified) current.justified += weight;
      else current.unjustified += weight;
      if (attendance.justified && attendance.justification) {
        const type = attendance.value === AttendanceValue.HALF ? "media" : attendance.value === AttendanceValue.QUARTER ? "cuarto" : "ausente";
        current.justifications.push({
          id: attendance.id,
          date: attendance.date.toISOString().slice(0, 10),
          type,
          reason: attendance.justification
        });
      }
      grouped.set(attendance.studentId, current);
    }
    const items = [...grouped.values()].sort((left, right) => right.total - left.total).slice((page - 1) * pageSize, page * pageSize);
    const total = grouped.size;
    res.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "No se pudo obtener el resumen de asistencias." });
  }
});
var attendance_routes_default = router;

// src/routes/auth.routes.ts
import express from "express";
import { PrismaClient as PrismaClient3 } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";

// src/services/mail.service.ts
import nodemailer from "nodemailer";
async function sendPasswordResetEmail(email, resetUrl) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !password || !from) {
    throw new Error("Falta configurar el servicio SMTP");
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password
    }
  });
  await transporter.sendMail({
    from,
    to: email,
    subject: "NOTAR - Recuperaci\xF3n de contrase\xF1a",
    text: [
      "Recibimos una solicitud para recuperar tu contrase\xF1a de NOTAR.",
      "",
      `Abr\xED este enlace para establecer una nueva contrase\xF1a: ${resetUrl}`,
      "",
      "El enlace vence en 15 minutos y solo puede utilizarse una vez.",
      "",
      "Si no solicitaste este cambio, ignor\xE1 este correo."
    ].join("\n")
  });
}

// src/schemas/auth.schema.ts
import { z as z4 } from "zod";
var loginSchema = z4.object({
  email: z4.email("El correo electr\xF3nico no es v\xE1lido"),
  password: z4.string().min(6, "La contrase\xF1a debe tener al menos 6 caracteres")
});
var forgotPasswordSchema = z4.object({
  email: z4.email("Ingres\xE1 un correo electr\xF3nico v\xE1lido").trim().toLowerCase()
});
var resetPasswordSchema = z4.object({
  token: z4.string().min(1, "El token es obligatorio"),
  password: z4.string().min(8, "La contrase\xF1a debe tener al menos 8 caracteres").max(72, "La contrase\xF1a es demasiado larga")
});

// src/routes/auth.routes.ts
var router2 = express.Router();
var prisma3 = new PrismaClient3();
var RESET_TOKEN_DURATION = 15 * 60 * 1e3;
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
router2.post("/login", async (req, res) => {
  try {
    const { user, password } = req.body;
    if (typeof user !== "string" || typeof password !== "string" || !user.trim() || !password) {
      return res.status(400).json({
        message: "Por favor, ingres\xE1 tu usuario y contrase\xF1a."
      });
    }
    const dbUser = await prisma3.user.findUnique({
      where: { email: user.trim().toLowerCase() }
    });
    if (!dbUser) {
      return res.status(401).json({
        message: "Credenciales inv\xE1lidas."
      });
    }
    const isPasswordValid = await bcrypt.compare(
      password,
      dbUser.passwordHash
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Credenciales inv\xE1lidas."
      });
    }
    if (dbUser.status !== "ACTIVE") {
      return res.status(403).json({
        message: "La cuenta no est\xE1 activa."
      });
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET no est\xE1 configurado");
      return res.status(500).json({
        message: "Error de configuraci\xF3n del servidor."
      });
    }
    const token = jwt.sign(
      {
        userId: dbUser.id,
        role: dbUser.role,
        name: `${dbUser.firstName} ${dbUser.lastName}`
      },
      jwtSecret,
      { expiresIn: "24h" }
    );
    return res.status(200).json({
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      message: "Error interno del servidor."
    });
  }
});
router2.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Ingres\xE1 un correo electr\xF3nico v\xE1lido."
    });
  }
  const genericMessage = "Si el correo est\xE1 registrado, recibir\xE1s un enlace de recuperaci\xF3n.";
  try {
    const { email } = parsed.data;
    const dbUser = await prisma3.user.findUnique({
      where: { email }
    });
    if (!dbUser || dbUser.status !== "ACTIVE") {
      return res.status(200).json({ message: genericMessage });
    }
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new Error("FRONTEND_URL no configurada");
    }
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION);
    await prisma3.passwordResetToken.create({
      data: {
        userId: dbUser.id,
        tokenHash,
        expiresAt
      }
    });
    const resetUrl = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendPasswordResetEmail(dbUser.email, resetUrl);
    } catch (mailError) {
      await prisma3.passwordResetToken.delete({
        where: { tokenHash }
      });
      throw mailError;
    }
    return res.status(200).json({
      message: genericMessage
    });
  } catch (error) {
    console.error("Error al solicitar recuperaci\xF3n:", error);
    return res.status(200).json({
      message: genericMessage
    });
  }
});
router2.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Token o contrase\xF1a inv\xE1lidos."
    });
  }
  try {
    const { token, password } = parsed.data;
    const tokenHash = hashToken(token);
    const resetRecord = await prisma3.passwordResetToken.findUnique({
      where: { tokenHash }
    });
    if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt <= /* @__PURE__ */ new Date()) {
      return res.status(400).json({
        message: "El enlace es inv\xE1lido o ha vencido."
      });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma3.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetRecord.id,
          usedAt: null,
          expiresAt: { gt: /* @__PURE__ */ new Date() },
          user: { status: "ACTIVE" }
        },
        data: { usedAt: /* @__PURE__ */ new Date() }
      });
      if (claimed.count !== 1) {
        return false;
      }
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash }
      });
      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetRecord.userId,
          usedAt: null
        },
        data: { usedAt: /* @__PURE__ */ new Date() }
      });
      return true;
    });
    if (!updated) {
      return res.status(400).json({
        message: "El enlace es inv\xE1lido o ha vencido."
      });
    }
    return res.status(200).json({
      message: "Contrase\xF1a actualizada correctamente."
    });
  } catch (error) {
    console.error("Error al restablecer contrase\xF1a:", error);
    return res.status(500).json({
      message: "No se pudo actualizar la contrase\xF1a."
    });
  }
});
var auth_routes_default = router2;

// src/routes/classSection.routes.ts
import { Router as Router3 } from "express";

// src/schemas/classSection.schema.ts
import { z as z5 } from "zod";
var listClassSectionsQuerySchema = z5.object({
  year: z5.coerce.number().int().min(2e3).max(2100).optional()
});

// src/services/classSection.service.ts
async function listClassSections(query) {
  return prisma.classSection.findMany({
    where: {
      academicYear: query.year !== void 0 ? { year: query.year } : { active: true }
    },
    orderBy: [{ grade: "asc" }, { division: "asc" }, { shift: "asc" }],
    select: {
      id: true,
      grade: true,
      division: true,
      shift: true,
      academicYear: { select: { year: true } }
    }
  });
}

// src/controllers/classSection.controller.ts
async function listClassSections2(req, res) {
  const query = listClassSectionsQuerySchema.parse(req.query);
  const sections = await listClassSections(query);
  res.json(
    sections.map((s) => ({
      id: s.id,
      year: s.academicYear.year,
      grade: s.grade,
      division: s.division,
      shift: s.shift
    }))
  );
}

// src/routes/classSection.routes.ts
var classSectionRouter = Router3();
classSectionRouter.get("/", asyncHandler(listClassSections2));

// src/routes/course.routes.ts
import { Router as Router4 } from "express";

// src/schemas/course.schema.ts
import { z as z6 } from "zod";
import { Shift, Orientation } from "@prisma/client";
var createClassSectionSchema = z6.object({
  grade: z6.number().int().min(1).max(7),
  division: z6.string().min(1),
  shift: z6.nativeEnum(Shift),
  orientation: z6.nativeEnum(Orientation).optional().nullable(),
  academicYearId: z6.string().uuid()
});
var updateClassSectionSchema = createClassSectionSchema.partial();
var createSubjectSchema = z6.object({
  name: z6.string().min(1),
  code: z6.string().min(1),
  hoursPerWeek: z6.number().int().positive(),
  gradeLevel: z6.number().int().min(1).max(7),
  area: z6.string().min(1)
});
var updateSubjectSchema = createSubjectSchema.partial();

// src/services/course.service.ts
import "@prisma/client";
var getAllClassSectionsService = async () => {
  return await prisma.classSection.findMany({
    include: {
      academicYear: true,
      _count: {
        select: { enrollments: true }
      }
    },
    orderBy: [{ grade: "asc" }, { division: "asc" }]
  });
};
var getClassSectionByIdService = async (id) => {
  return await prisma.classSection.findUnique({
    where: { id },
    include: {
      academicYear: true,
      enrollments: true,
      teacherAssignments: {
        include: { teacher: true, subject: true }
      }
    }
  });
};
var createClassSectionService = async (data) => {
  return await prisma.classSection.create({
    data
  });
};
var updateClassSectionService = async (id, data) => {
  return await prisma.classSection.update({
    where: { id },
    data
  });
};
var deleteClassSectionService = async (id) => {
  return await prisma.classSection.delete({
    where: { id }
  });
};
var getAllSubjectsService = async () => {
  return await prisma.subject.findMany({
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }]
  });
};
var getSubjectByIdService = async (id) => {
  return await prisma.subject.findUnique({
    where: { id }
  });
};
var createSubjectService = async (data) => {
  return await prisma.subject.create({
    data
  });
};
var updateSubjectService = async (id, data) => {
  return await prisma.subject.update({
    where: { id },
    data
  });
};
var deleteSubjectService = async (id) => {
  return await prisma.subject.delete({
    where: { id }
  });
};

// src/controllers/course.controller.ts
var getClassSections = async (_req, res) => {
  try {
    const sections = await getAllClassSectionsService();
    return res.status(200).json(sections);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener los cursos." });
  }
};
var getClassSectionById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID de curso requerido." });
    const section = await getClassSectionByIdService(id);
    if (!section) return res.status(404).json({ error: "Curso no encontrado." });
    return res.status(200).json(section);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener el curso." });
  }
};
var createClassSection = async (req, res) => {
  try {
    const validatedData = createClassSectionSchema.parse(req.body);
    const { orientation, ...baseData } = validatedData;
    const payload = orientation === void 0 ? baseData : { ...baseData, orientation };
    const newSection = await createClassSectionService(payload);
    return res.status(201).json(newSection);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: "Error al crear el curso." });
  }
};
var updateClassSection = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID de curso requerido." });
    const validatedData = updateClassSectionSchema.parse(req.body);
    const updatedSection = await updateClassSectionService(id, validatedData);
    return res.status(200).json(updatedSection);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: "Error al actualizar el curso." });
  }
};
var deleteClassSection = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID de curso requerido." });
    await deleteClassSectionService(id);
    return res.status(200).json({ message: "Curso eliminado correctamente." });
  } catch (error) {
    return res.status(500).json({ error: "Error al eliminar el curso." });
  }
};
var getSubjects = async (_req, res) => {
  try {
    const subjects = await getAllSubjectsService();
    return res.status(200).json(subjects);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener las materias." });
  }
};
var getSubjectById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID de materia requerido." });
    const subject = await getSubjectByIdService(id);
    if (!subject) return res.status(404).json({ error: "Materia no encontrada." });
    return res.status(200).json(subject);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener la materia." });
  }
};
var createSubject = async (req, res) => {
  try {
    const validatedData = createSubjectSchema.parse(req.body);
    const newSubject = await createSubjectService(validatedData);
    return res.status(201).json(newSubject);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: "Error al crear la materia." });
  }
};
var updateSubject = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID de materia requerido." });
    const validatedData = updateSubjectSchema.parse(req.body);
    const updatedSubject = await updateSubjectService(id, validatedData);
    return res.status(200).json(updatedSubject);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError")
      return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: "Error al actualizar la materia." });
  }
};
var deleteSubject = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID de materia requerido." });
    await deleteSubjectService(id);
    return res.status(200).json({ message: "Materia eliminada correctamente." });
  } catch (error) {
    return res.status(500).json({ error: "Error al eliminar la materia." });
  }
};

// src/routes/course.routes.ts
var router3 = Router4();
router3.get("/class-sections", getClassSections);
router3.get("/class-sections/:id", getClassSectionById);
router3.post("/class-sections", createClassSection);
router3.put("/class-sections/:id", updateClassSection);
router3.delete("/class-sections/:id", deleteClassSection);
router3.get("/subjects", getSubjects);
router3.get("/subjects/:id", getSubjectById);
router3.post("/subjects", createSubject);
router3.put("/subjects/:id", updateSubject);
router3.delete("/subjects/:id", deleteSubject);
var course_routes_default = router3;

// src/routes/enrollment.routes.ts
import { Router as Router5 } from "express";

// src/schemas/enrollment.schema.ts
import { z as z7 } from "zod";
var enrollmentIdParamSchema = z7.object({
  id: z7.uuid()
});
var createEnrollmentSchema = z7.object({
  studentId: z7.uuid(),
  classSectionId: z7.uuid()
});
var updateEnrollmentSchema = z7.object({
  classSectionId: z7.uuid()
});

// src/services/enrollment.service.ts
import { StudentStatus } from "@prisma/client";
var ENROLLABLE_STATUSES = [StudentStatus.ACTIVE, StudentStatus.CONDITIONAL];
async function createEnrollment(input) {
  const [student, classSection] = await Promise.all([
    prisma.student.findUnique({ where: { id: input.studentId }, select: { status: true } }),
    prisma.classSection.findUnique({
      where: { id: input.classSectionId },
      select: { academicYearId: true, academicYear: { select: { active: true } } }
    })
  ]);
  if (!student) throw new HttpError(404, "Student not found");
  if (!ENROLLABLE_STATUSES.includes(student.status)) {
    throw new HttpError(409, "Student status does not allow enrollment");
  }
  if (!classSection) throw new HttpError(404, "Class section not found");
  if (!classSection.academicYear.active) {
    throw new HttpError(409, "Enrollments are only allowed in the active academic year");
  }
  const openEnrollment = await prisma.enrollmentHistory.findFirst({
    where: {
      studentId: input.studentId,
      endDate: null,
      classSection: { academicYearId: classSection.academicYearId }
    },
    select: { id: true }
  });
  if (openEnrollment) {
    throw new HttpError(409, "Student is already enrolled in this academic year");
  }
  return prisma.enrollmentHistory.create({ data: input });
}
async function updateEnrollment(id, input) {
  const enrollment = await prisma.enrollmentHistory.findUnique({
    where: { id },
    select: {
      endDate: true,
      classSection: {
        select: { academicYearId: true, academicYear: { select: { active: true } } }
      }
    }
  });
  if (!enrollment) throw new HttpError(404, "Enrollment not found");
  if (enrollment.endDate || !enrollment.classSection.academicYear.active) {
    throw new HttpError(409, "Only the current cycle enrollment can be updated");
  }
  const target = await prisma.classSection.findUnique({
    where: { id: input.classSectionId },
    select: { academicYearId: true }
  });
  if (!target) throw new HttpError(404, "Class section not found");
  if (target.academicYearId !== enrollment.classSection.academicYearId) {
    throw new HttpError(409, "The new class section must belong to the same academic year");
  }
  return prisma.enrollmentHistory.update({
    where: { id },
    data: { classSectionId: input.classSectionId }
  });
}

// src/controllers/enrollment.controller.ts
async function createEnrollment2(req, res) {
  const input = createEnrollmentSchema.parse(req.body);
  res.status(201).json(await createEnrollment(input));
}
async function updateEnrollment2(req, res) {
  const { id } = enrollmentIdParamSchema.parse(req.params);
  const input = updateEnrollmentSchema.parse(req.body);
  res.json(await updateEnrollment(id, input));
}

// src/routes/enrollment.routes.ts
var enrollmentRouter = Router5();
enrollmentRouter.post("/", asyncHandler(createEnrollment2));
enrollmentRouter.put("/:id", asyncHandler(updateEnrollment2));

// src/routes/grade.routes.ts
import { Router as Router6 } from "express";

// src/schemas/grade.schema.ts
import { z as z8 } from "zod";
import { PreliminaryAssessment, SubjectStatus } from "@prisma/client";
var scoreSchema = z8.number().int("La nota debe ser un n\xFAmero entero").min(1, "La nota m\xEDnima es 1").max(10, "La nota m\xE1xima es 10");
var termScoresSchema = z8.array(scoreSchema.nullable()).length(4, "Deben ser 4 notas (us\xE1 null para las vac\xEDas)");
var gradeIdParamSchema = z8.object({
  id: z8.uuid()
});
var createGradeSchema = z8.object({
  enrollmentId: z8.uuid(),
  preliminaryAssessment1: z8.enum(PreliminaryAssessment).optional(),
  rationale1: z8.string().trim().optional(),
  term1Score: scoreSchema.optional(),
  term1Scores: termScoresSchema.optional(),
  preliminaryAssessment2: z8.enum(PreliminaryAssessment).optional(),
  rationale2: z8.string().trim().optional(),
  term2Score: scoreSchema.optional(),
  term2Scores: termScoresSchema.optional(),
  recoveryIn2ndTerm: z8.boolean().optional(),
  finalScore: scoreSchema.optional(),
  subjectStatus: z8.enum(SubjectStatus).optional(),
  term1Closed: z8.boolean().optional(),
  term2Closed: z8.boolean().optional()
});
var updateGradeSchema = createGradeSchema.omit({ enrollmentId: true }).partial();
var listGradesQuerySchema = z8.object({
  page: z8.coerce.number().int().min(1).default(1),
  limit: z8.coerce.number().int().min(1).max(100).default(10),
  studentId: z8.uuid().optional(),
  // nuevo: filtrar notas por alumno
  classSectionId: z8.uuid().optional(),
  subjectId: z8.uuid().optional(),
  year: z8.coerce.number().int().min(2e3).max(2100).optional(),
  subjectStatus: z8.enum(SubjectStatus).optional()
});
var gradeRosterQuerySchema = z8.object({
  classSectionId: z8.uuid(),
  subjectId: z8.uuid(),
  year: z8.coerce.number().int().min(2e3).max(2100)
});
var gradeByStudentQuerySchema = z8.object({
  studentId: z8.uuid(),
  year: z8.coerce.number().int().min(2e3).max(2100)
});

// src/services/grade.service.ts
import "@prisma/client";
var gradeListInclude = {
  enrollment: {
    select: {
      id: true,
      student: { select: { id: true, dni: true, lastName: true, firstName: true } },
      subject: { select: { id: true, name: true } },
      classSection: { select: { id: true, grade: true, division: true } },
      academicYear: { select: { id: true, year: true } }
    }
  }
};
function buildGradeWhere(query) {
  const where = {};
  const enrollment = {};
  if (query.studentId) enrollment.studentId = query.studentId;
  if (query.classSectionId) enrollment.classSectionId = query.classSectionId;
  if (query.subjectId) enrollment.subjectId = query.subjectId;
  if (query.year !== void 0) enrollment.academicYear = { year: query.year };
  if (Object.keys(enrollment).length > 0) where.enrollment = enrollment;
  if (query.subjectStatus) where.subjectStatus = query.subjectStatus;
  return where;
}
async function listGrades(query) {
  const where = buildGradeWhere(query);
  const [data, total] = await prisma.$transaction([
    prisma.grade.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: gradeListInclude
    }),
    prisma.grade.count({ where })
  ]);
  return {
    data,
    total,
    page: query.page,
    totalPages: Math.ceil(total / query.limit)
  };
}
var gradeRosterSelect = {
  id: true,
  student: { select: { id: true, dni: true, lastName: true, firstName: true } },
  subject: { select: { id: true, name: true } },
  grade: {
    select: {
      id: true,
      term1Scores: true,
      term2Scores: true,
      term1Score: true,
      term2Score: true,
      finalScore: true,
      subjectStatus: true,
      term1Closed: true,
      term2Closed: true
    }
  }
};
async function getGradeRoster(query) {
  return prisma.enrollment.findMany({
    where: {
      classSectionId: query.classSectionId,
      subjectId: query.subjectId,
      academicYear: { year: query.year }
    },
    select: gradeRosterSelect,
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }]
  });
}
var gradeByStudentSelect = {
  id: true,
  subject: { select: { id: true, name: true } },
  grade: {
    select: {
      id: true,
      term1Scores: true,
      term2Scores: true,
      term1Score: true,
      term2Score: true,
      finalScore: true,
      subjectStatus: true,
      term1Closed: true,
      term2Closed: true
    }
  }
};
async function getGradesByStudent(query) {
  return prisma.enrollment.findMany({
    where: {
      studentId: query.studentId,
      academicYear: { year: query.year }
    },
    select: gradeByStudentSelect,
    orderBy: { subject: { name: "asc" } }
  });
}
async function upsertGrade(input) {
  const { enrollmentId, ...scores } = input;
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true }
  });
  if (!enrollment) throw new HttpError(404, "Enrollment not found");
  return prisma.grade.upsert({
    where: { enrollmentId },
    update: scores,
    create: { enrollmentId, ...scores }
  });
}
async function updateGrade(id, input) {
  const grade = await prisma.grade.findUnique({ where: { id }, select: { id: true } });
  if (!grade) throw new HttpError(404, "Grade not found");
  return prisma.grade.update({
    where: { id },
    data: input
  });
}
async function deleteGrade(id) {
  const grade = await prisma.grade.findUnique({ where: { id }, select: { id: true } });
  if (!grade) throw new HttpError(404, "Grade not found");
  await prisma.grade.delete({ where: { id } });
}

// src/controllers/grade.controller.ts
async function listGrades2(req, res) {
  const query = listGradesQuerySchema.parse(req.query);
  res.json(await listGrades(query));
}
async function getGradeRoster2(req, res) {
  const query = gradeRosterQuerySchema.parse(req.query);
  res.json(await getGradeRoster(query));
}
async function getGradesByStudent2(req, res) {
  const query = gradeByStudentQuerySchema.parse(req.query);
  res.json(await getGradesByStudent(query));
}
async function createGrade(req, res) {
  const input = createGradeSchema.parse(req.body);
  res.status(201).json(await upsertGrade(input));
}
async function updateGrade2(req, res) {
  const { id } = gradeIdParamSchema.parse(req.params);
  const input = updateGradeSchema.parse(req.body);
  res.json(await updateGrade(id, input));
}
async function deleteGrade2(req, res) {
  const { id } = gradeIdParamSchema.parse(req.params);
  await deleteGrade(id);
  res.status(204).send();
}

// src/routes/grade.routes.ts
var gradeRouter = Router6();
gradeRouter.get("/", asyncHandler(listGrades2));
gradeRouter.get("/roster", asyncHandler(getGradeRoster2));
gradeRouter.get("/by-student", asyncHandler(getGradesByStudent2));
gradeRouter.post("/", asyncHandler(createGrade));
gradeRouter.put("/:id", asyncHandler(updateGrade2));
gradeRouter.delete("/:id", asyncHandler(deleteGrade2));

// src/routes/notification.routes.ts
import { AlertType } from "@prisma/client";
import { Router as Router7 } from "express";
import { z as z9 } from "zod";
var router4 = Router7();
var backendAlertTypeSchema = z9.enum([
  "ABSENCES",
  "PENDING_SUBJECTS",
  "TED_ASSESSMENT",
  "DROPOUT_RISK",
  "HEALTH",
  "CONDUCT"
]);
var alertSeveritySchema = z9.enum(["LOW", "MEDIUM", "HIGH"]);
var createNotificationSchema = z9.object({
  studentId: z9.string().min(1),
  type: backendAlertTypeSchema,
  severity: alertSeveritySchema.optional(),
  message: z9.string().min(1),
  read: z9.boolean().optional().default(false)
});
var updateNotificationSchema = z9.object({
  type: backendAlertTypeSchema.optional(),
  severity: alertSeveritySchema.optional(),
  message: z9.string().min(1).optional(),
  read: z9.boolean().optional()
});
var mapDbTypeToUi = (type) => {
  switch (type) {
    case "HEALTH":
      return "HEALTH";
    case "CONDUCT":
      return "CONDUCT";
    case "ABSENCES":
      return "ABSENCE";
    default:
      return "ACADEMIC";
  }
};
var deriveSeverity = (type) => {
  switch (type) {
    case "ABSENCES":
      return "HIGH";
    case "HEALTH":
      return "MEDIUM";
    case "CONDUCT":
      return "MEDIUM";
    default:
      return "LOW";
  }
};
var formatShift = (shift) => {
  const labels = {
    MORNING: "Ma\xF1ana",
    AFTERNOON: "Tarde",
    EVENING: "Vespertino",
    EXTRA_TIME: "Contraturno"
  };
  return labels[shift] ?? shift;
};
var mapToUiPayload = (notification) => {
  const section = notification.student.enrollmentHistory[0]?.classSection;
  const uiType = mapDbTypeToUi(notification.type);
  return {
    id: notification.id,
    studentId: notification.studentId,
    studentName: `${notification.student.lastName}, ${notification.student.firstName}`,
    sectionName: section ? `${section.grade}\xB0 ${section.division} (${formatShift(section.shift)})` : "Sin curso asignado",
    type: uiType,
    severity: notification.severity,
    title: notification.type === AlertType.HEALTH ? "Salud / reposo" : notification.type === AlertType.CONDUCT ? "Mala conducta" : notification.type === AlertType.ABSENCES ? "Inasistencias" : "Rendimiento acad\xE9mico",
    description: notification.message,
    valueMetric: notification.type === AlertType.HEALTH ? "Seguimiento de salud" : notification.type === AlertType.CONDUCT ? "Convivencia" : notification.type === AlertType.ABSENCES ? "Monitoreo de asistencia" : "Rendimiento",
    createdAt: notification.createdAt.toISOString(),
    status: notification.read ? "RESOLVED" : "OPEN",
    note: notification.message
  };
};
router4.get("/", async (_req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          enrollmentHistory: {
            orderBy: [{ startDate: "desc" }],
            take: 1,
            select: {
              classSection: {
                select: {
                  grade: true,
                  division: true,
                  shift: true
                }
              }
            }
          }
        }
      }
    }
  });
  res.json(notifications.map(mapToUiPayload));
});
router4.post("/", async (req, res) => {
  const validated = createNotificationSchema.parse(req.body);
  const notification = await prisma.notification.create({
    data: {
      studentId: validated.studentId,
      type: validated.type,
      severity: validated.severity ?? deriveSeverity(validated.type),
      message: validated.message,
      read: validated.read
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          enrollmentHistory: {
            orderBy: [{ startDate: "desc" }],
            take: 1,
            select: {
              classSection: {
                select: {
                  grade: true,
                  division: true,
                  shift: true
                }
              }
            }
          }
        }
      }
    }
  });
  res.status(201).json(mapToUiPayload(notification));
});
router4.patch("/:id", async (req, res) => {
  const idSchema = z9.object({ id: z9.string().min(1) });
  const params = idSchema.parse(req.params);
  const payload = updateNotificationSchema.parse(req.body);
  const notification = await prisma.notification.update({
    where: { id: params.id },
    data: {
      ...payload.type !== void 0 ? { type: payload.type } : {},
      ...payload.severity !== void 0 ? { severity: payload.severity } : {},
      ...payload.message !== void 0 ? { message: payload.message } : {},
      ...payload.read !== void 0 ? { read: payload.read } : {}
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          enrollmentHistory: {
            orderBy: [{ startDate: "desc" }],
            take: 1,
            select: {
              classSection: {
                select: {
                  grade: true,
                  division: true,
                  shift: true
                }
              }
            }
          }
        }
      }
    }
  });
  res.json(mapToUiPayload(notification));
});
var notification_routes_default = router4;

// src/routes/student.routes.ts
import { Router as Router8 } from "express";

// src/schemas/student.schema.ts
import { z as z10 } from "zod";
import { Shift as Shift3, StudentStatus as StudentStatus2 } from "@prisma/client";
var studentIdParamSchema = z10.object({
  id: z10.uuid()
});
var listStudentsQuerySchema = z10.object({
  page: z10.coerce.number().int().min(1).default(1),
  limit: z10.coerce.number().int().min(1).max(100).default(10),
  search: z10.string().trim().min(1).max(100).optional(),
  // Omitted -> operational listing (ACTIVE + CONDITIONAL). "all" -> every status.
  status: z10.union([z10.enum(StudentStatus2), z10.literal("all")]).optional(),
  year: z10.coerce.number().int().min(2e3).max(2100).optional(),
  grade: z10.coerce.number().int().min(1).max(7).optional(),
  division: z10.string().trim().min(1).max(10).optional(),
  shift: z10.enum(Shift3).optional()
});
var createStudentSchema = z10.object({
  firstName: z10.string().trim().min(1).max(100),
  lastName: z10.string().trim().min(1).max(100),
  dni: z10.string().trim().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 d\xEDgitos"),
  dateOfBirth: z10.coerce.date(),
  placeOfBirth: z10.string().trim().min(1).max(150),
  address: z10.string().trim().min(1).max(200),
  city: z10.string().trim().min(1).max(100),
  phone: z10.string().trim().regex(/^\d{6,15}$/, "Tel\xE9fono inv\xE1lido"),
  classSectionId: z10.uuid(),
  guardianName: z10.string().trim().min(1).max(150),
  guardianPhone: z10.string().trim().regex(/^\d{6,15}$/, "Tel\xE9fono inv\xE1lido"),
  guardianEmail: z10.email(),
  guardianDni: z10.string().trim().regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 d\xEDgitos").optional(),
  guardianRelationship: z10.string().trim().min(1).max(50).optional()
});
var updateStudentSchema = createStudentSchema.pick({
  firstName: true,
  lastName: true,
  dni: true,
  dateOfBirth: true,
  placeOfBirth: true,
  address: true,
  city: true,
  phone: true,
  guardianName: true,
  guardianPhone: true,
  guardianEmail: true,
  guardianDni: true,
  guardianRelationship: true
}).partial().refine((data) => Object.keys(data).length > 0, {
  message: "Hay que enviar al menos un campo para actualizar"
});

// src/services/student.service.ts
import { Prisma as Prisma5, StudentStatus as StudentStatus3 } from "@prisma/client";
var OPERATIONAL_STATUSES = [StudentStatus3.ACTIVE, StudentStatus3.CONDITIONAL];
var classSectionSummarySelect2 = {
  grade: true,
  division: true,
  shift: true,
  academicYear: { select: { year: true } }
};
var studentListSelect = {
  id: true,
  dni: true,
  firstName: true,
  lastName: true,
  recordNumber: true,
  status: true,
  enrollmentHistory: {
    where: { endDate: null },
    orderBy: { startDate: "desc" },
    take: 1,
    select: { classSection: { select: classSectionSummarySelect2 } }
  }
};
function buildStudentWhere(query) {
  const where = {};
  if (query.status === void 0) {
    where.status = { in: OPERATIONAL_STATUSES };
  } else if (query.status !== "all") {
    where.status = query.status;
  }
  if (query.search) {
    const terms = query.search.split(/\s+/);
    where.AND = terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { dni: { contains: term } }
      ]
    }));
  }
  const hasSectionFilter = query.year !== void 0 || query.grade !== void 0 || query.division || query.shift;
  if (hasSectionFilter) {
    where.enrollmentHistory = {
      some: {
        ...query.year === void 0 ? { endDate: null } : {},
        classSection: {
          academicYear: query.year !== void 0 ? { year: query.year } : { active: true },
          ...query.grade !== void 0 ? { grade: query.grade } : {},
          ...query.division ? { division: query.division } : {},
          ...query.shift ? { shift: query.shift } : {}
        }
      }
    };
  }
  return where;
}
async function listStudents(query) {
  const where = buildStudentWhere(query);
  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: studentListSelect
    }),
    prisma.student.count({ where })
  ]);
  const data = students.map(({ enrollmentHistory, ...student }) => {
    const section = enrollmentHistory[0]?.classSection;
    return {
      ...student,
      currentSection: section ? {
        year: section.academicYear.year,
        grade: section.grade,
        division: section.division,
        shift: section.shift
      } : null
    };
  });
  return {
    data,
    total,
    page: query.page,
    totalPages: Math.ceil(total / query.limit)
  };
}
var MAX_RECORD_NUMBER_ATTEMPTS = 5;
var studentDetailSelect = {
  id: true,
  dni: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  placeOfBirth: true,
  address: true,
  city: true,
  phone: true,
  recordNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  guardians: {
    select: {
      isPrimary: true,
      guardian: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          dni: true,
          relationship: true
        }
      }
    }
  },
  enrollmentHistory: {
    where: { endDate: null },
    orderBy: { startDate: "desc" },
    take: 1,
    select: { classSection: { select: classSectionSummarySelect2 } }
  }
};
function splitGuardianName(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    const only = parts[0] ?? fullName.trim();
    return { firstName: only, lastName: only };
  }
  const lastName = parts.pop();
  const firstName = parts.join(" ");
  return { firstName, lastName };
}
async function buildStudentResponse(client, id) {
  const student = await client.student.findUnique({ where: { id }, select: studentDetailSelect });
  if (!student) throw new HttpError(404, "Student not found");
  const { enrollmentHistory, guardians, ...rest } = student;
  const section = enrollmentHistory[0]?.classSection;
  return {
    ...rest,
    currentSection: section ? {
      year: section.academicYear.year,
      grade: section.grade,
      division: section.division,
      shift: section.shift
    } : null,
    guardians: guardians.map((g) => ({
      ...g.guardian,
      isPrimary: g.isPrimary
    }))
  };
}
async function getStudent(id) {
  return buildStudentResponse(prisma, id);
}
async function createStudent(input) {
  const classSection = await prisma.classSection.findUnique({
    where: { id: input.classSectionId },
    select: { id: true, academicYear: { select: { year: true } } }
  });
  if (!classSection) throw new HttpError(404, "Class section not found");
  const { firstName: guardianFirstName, lastName: guardianLastName } = splitGuardianName(
    input.guardianName
  );
  const year = classSection.academicYear.year;
  for (let attempt = 0; attempt < MAX_RECORD_NUMBER_ATTEMPTS; attempt++) {
    const count = await prisma.student.count({
      where: { recordNumber: { startsWith: `${year}-` } }
    });
    const recordNumber = `${year}-${String(count + 1).padStart(4, "0")}`;
    try {
      const studentId = await prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            dni: input.dni,
            dateOfBirth: input.dateOfBirth,
            placeOfBirth: input.placeOfBirth,
            address: input.address,
            city: input.city,
            phone: input.phone,
            recordNumber
          }
        });
        const guardian = await tx.guardian.create({
          data: {
            firstName: guardianFirstName,
            lastName: guardianLastName,
            phone: input.guardianPhone,
            email: input.guardianEmail,
            dni: input.guardianDni ?? null,
            relationship: input.guardianRelationship ?? null
          }
        });
        await tx.studentGuardian.create({
          data: { studentId: student.id, guardianId: guardian.id, isPrimary: true }
        });
        await tx.enrollmentHistory.create({
          data: { studentId: student.id, classSectionId: classSection.id }
        });
        return student.id;
      });
      return buildStudentResponse(prisma, studentId);
    } catch (err) {
      const isRecordNumberConflict = err instanceof Prisma5.PrismaClientKnownRequestError && err.code === "P2002" && err.meta?.target?.includes("recordNumber");
      if (isRecordNumberConflict && attempt < MAX_RECORD_NUMBER_ATTEMPTS - 1) continue;
      throw err;
    }
  }
  throw new HttpError(500, "No se pudo generar un n\xFAmero de legajo \xFAnico");
}
async function deactivateStudent(id) {
  const student = await prisma.student.findUnique({ where: { id }, select: { status: true } });
  if (!student) throw new HttpError(404, "Student not found");
  if (student.status === StudentStatus3.INACTIVE) {
    throw new HttpError(409, "Student is already inactive");
  }
  return prisma.student.update({
    where: { id },
    data: { status: StudentStatus3.INACTIVE },
    select: { id: true, firstName: true, lastName: true, status: true }
  });
}
async function getStudentHistory(id) {
  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) throw new HttpError(404, "Student not found");
  const records = await prisma.enrollmentHistory.findMany({
    where: { studentId: id },
    orderBy: [{ classSection: { academicYear: { year: "desc" } } }, { startDate: "desc" }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      leaveReason: true,
      classSection: { select: classSectionSummarySelect2 }
    }
  });
  return records.map(({ classSection, ...record }) => ({
    id: record.id,
    year: classSection.academicYear.year,
    grade: classSection.grade,
    division: classSection.division,
    section: `${classSection.grade}\xB0 ${classSection.division}`,
    shift: classSection.shift,
    startDate: record.startDate,
    endDate: record.endDate,
    leaveReason: record.leaveReason
  }));
}
async function updateStudent(id, input) {
  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) throw new HttpError(404, "Student not found");
  if (input.dni) {
    const duplicated = await prisma.student.findFirst({
      where: { dni: input.dni, NOT: { id } },
      select: { id: true }
    });
    if (duplicated) throw new HttpError(409, "Another student already has this DNI");
  }
  const {
    guardianName,
    guardianPhone,
    guardianEmail,
    guardianDni,
    guardianRelationship,
    ...studentData
  } = input;
  const hasGuardianData = [
    guardianName,
    guardianPhone,
    guardianEmail,
    guardianDni,
    guardianRelationship
  ].some((value) => value !== void 0);
  await prisma.$transaction(async (tx) => {
    if (Object.keys(studentData).length > 0) {
      await tx.student.update({ where: { id }, data: studentData });
    }
    if (!hasGuardianData) return;
    const guardianData = {
      ...guardianName !== void 0 ? splitGuardianName(guardianName) : {},
      ...guardianPhone !== void 0 ? { phone: guardianPhone } : {},
      ...guardianEmail !== void 0 ? { email: guardianEmail } : {},
      ...guardianDni !== void 0 ? { dni: guardianDni } : {},
      ...guardianRelationship !== void 0 ? { relationship: guardianRelationship } : {}
    };
    const primaryLink = await tx.studentGuardian.findFirst({
      where: { studentId: id, isPrimary: true },
      select: { guardianId: true }
    });
    if (primaryLink) {
      await tx.guardian.update({ where: { id: primaryLink.guardianId }, data: guardianData });
      return;
    }
    if (!guardianName || !guardianPhone || !guardianEmail) {
      throw new HttpError(
        400,
        "Para registrar un adulto responsable hacen falta nombre, tel\xE9fono y email"
      );
    }
    const guardian = await tx.guardian.create({
      data: {
        ...splitGuardianName(guardianName),
        phone: guardianPhone,
        email: guardianEmail,
        dni: guardianDni ?? null,
        relationship: guardianRelationship ?? null
      }
    });
    await tx.studentGuardian.create({
      data: { studentId: id, guardianId: guardian.id, isPrimary: true }
    });
  });
  return buildStudentResponse(prisma, id);
}

// src/controllers/student.controller.ts
async function listStudents2(req, res) {
  const query = listStudentsQuerySchema.parse(req.query);
  res.json(await listStudents(query));
}
async function deactivateStudent2(req, res) {
  const { id } = studentIdParamSchema.parse(req.params);
  res.json(await deactivateStudent(id));
}
async function getStudentHistory2(req, res) {
  const { id } = studentIdParamSchema.parse(req.params);
  res.json(await getStudentHistory(id));
}
async function createStudent2(req, res) {
  const data = createStudentSchema.parse(req.body);
  res.status(201).json(await createStudent(data));
}
async function getStudent2(req, res) {
  const { id } = studentIdParamSchema.parse(req.params);
  res.json(await getStudent(id));
}
async function updateStudent2(req, res) {
  const { id } = studentIdParamSchema.parse(req.params);
  const data = updateStudentSchema.parse(req.body);
  res.json(await updateStudent(id, data));
}

// src/routes/student.routes.ts
var studentRouter = Router8();
studentRouter.get("/", asyncHandler(listStudents2));
studentRouter.patch("/:id/deactivate", asyncHandler(deactivateStudent2));
studentRouter.post("/", asyncHandler(createStudent2));
studentRouter.get("/:id", asyncHandler(getStudent2));
studentRouter.patch("/:id", asyncHandler(updateStudent2));
studentRouter.get("/:id/history", asyncHandler(getStudentHistory2));

// src/routes/user.routes.ts
import { Router as Router9 } from "express";
import { Role as Role3, UserStatus } from "@prisma/client";
import bcrypt2 from "bcrypt";

// src/middlewares/auth.middleware.ts
import "@prisma/client";
import jwt2 from "jsonwebtoken";
async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "Token de autenticaci\xF3n requerido");
    }
    const token = authorization.slice(7);
    if (!process.env.JWT_SECRET) {
      throw new HttpError(500, "JWT_SECRET no est\xE1 configurado");
    }
    const decoded = jwt2.verify(token, process.env.JWT_SECRET);
    if (!decoded.userId || typeof decoded.userId !== "string") {
      throw new HttpError(401, "Token inv\xE1lido");
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        status: true
      }
    });
    if (!user || user.status !== "ACTIVE") {
      throw new HttpError(403, "Usuario inactivo o suspendido");
    }
    res.locals.authUser = {
      id: user.id,
      role: user.role
    };
    next();
  } catch (error) {
    if (error instanceof jwt2.JsonWebTokenError) {
      next(new HttpError(401, "Token inv\xE1lido o expirado"));
      return;
    }
    next(error);
  }
}
function requireRole(...allowedRoles) {
  return (_req, res, next) => {
    const user = res.locals.authUser;
    if (!user) {
      next(new HttpError(401, "Usuario no autenticado"));
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      next(new HttpError(403, "No ten\xE9s permisos para esta operaci\xF3n"));
      return;
    }
    next();
  };
}

// src/routes/user.routes.ts
var router5 = Router9();
router5.use(requireAuth, requireRole(Role3.ADMINISTRATOR));
var frontendRoles = {
  ADMINISTRATOR: "admin",
  TEACHER: "docente",
  PRECEPTOR: "preceptor"
};
var backendRoles = {
  admin: Role3.ADMINISTRATOR,
  docente: Role3.TEACHER,
  preceptor: Role3.PRECEPTOR
};
var userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true
};
function toFrontendUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: frontendRoles[user.role] ?? user.role.toLowerCase(),
    active: user.status === UserStatus.ACTIVE,
    // Campos que todavía no existen en el modelo User.
    dni: "",
    phone: null,
    username: user.email,
    courseIds: []
  };
}
function validateInput(body, creating) {
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!firstName || !lastName || !email) {
    throw new HttpError(
      400,
      "Nombre, apellido y correo son obligatorios"
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(
      400,
      "Correo electr\xF3nico inv\xE1lido"
    );
  }
  if (typeof body.role !== "string" || !(body.role in backendRoles)) {
    throw new HttpError(
      400,
      "Rol no admitido. Se permiten administrador, docente y preceptor"
    );
  }
  if (body.courseIds !== void 0 && (!Array.isArray(body.courseIds) || body.courseIds.length > 0)) {
    throw new HttpError(
      400,
      "La asignaci\xF3n de cursos todav\xEDa no est\xE1 integrada"
    );
  }
  if (typeof body.dni === "string" && body.dni.trim() || typeof body.phone === "string" && body.phone.trim() || typeof body.username === "string" && body.username.trim() && body.username.trim() !== email) {
    throw new HttpError(
      400,
      "DNI, tel\xE9fono y nombre de usuario independiente todav\xEDa no est\xE1n disponibles en la base de datos"
    );
  }
  const password = typeof body.password === "string" ? body.password : "";
  if ((creating || password.length > 0) && password.length < 8) {
    throw new HttpError(
      400,
      "La contrase\xF1a debe tener al menos 8 caracteres"
    );
  }
  return {
    firstName,
    lastName,
    email,
    role: backendRoles[body.role],
    status: body.active === false ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
    password
  };
}
router5.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new HttpError(400, "Paginaci\xF3n inv\xE1lida");
    }
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const role = req.query.role;
    const active = req.query.active;
    const where = {
      role: {
        in: [
          Role3.ADMINISTRATOR,
          Role3.TEACHER,
          Role3.PRECEPTOR
        ]
      }
    };
    if (role !== void 0 && role !== "") {
      if (typeof role !== "string" || !(role in backendRoles)) {
        throw new HttpError(
          400,
          "Filtro de rol no admitido"
        );
      }
      where.role = backendRoles[role];
    }
    if (active !== void 0 && active !== "") {
      if (active !== "true" && active !== "false") {
        throw new HttpError(
          400,
          "Filtro de estado inv\xE1lido"
        );
      }
      where.status = active === "true" ? UserStatus.ACTIVE : { not: UserStatus.ACTIVE };
    }
    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          lastName: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          email: {
            contains: search,
            mode: "insensitive"
          }
        }
      ];
    }
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [
          { lastName: "asc" },
          { firstName: "asc" }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ]);
    res.json({
      success: true,
      data: users.map(toFrontendUser),
      pagination: {
        page,
        limit,
        total
      }
    });
  })
);
router5.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect
    });
    if (!user) {
      throw new HttpError(
        404,
        "Usuario no encontrado"
      );
    }
    res.json({
      success: true,
      data: toFrontendUser(user)
    });
  })
);
router5.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = validateInput(req.body ?? {}, true);
    const existing = await prisma.user.findUnique({
      where: { email: input.email }
    });
    if (existing) {
      throw new HttpError(
        409,
        "El correo ya est\xE1 registrado"
      );
    }
    const user = await prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        status: input.status,
        passwordHash: await bcrypt2.hash(
          input.password,
          12
        )
      },
      select: userSelect
    });
    res.status(201).json({
      success: true,
      data: toFrontendUser(user)
    });
  })
);
router5.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = validateInput(req.body ?? {}, false);
    const id = String(req.params.id);
    const existing = await prisma.user.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new HttpError(
        404,
        "Usuario no encontrado"
      );
    }
    if (existing.id === res.locals.authUser.id && (input.role !== Role3.ADMINISTRATOR || input.status !== UserStatus.ACTIVE)) {
      throw new HttpError(
        400,
        "No pod\xE9s quitarte tus propios permisos de administrador"
      );
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        status: input.status,
        ...input.password ? {
          passwordHash: await bcrypt2.hash(
            input.password,
            12
          )
        } : {}
      },
      select: userSelect
    });
    res.json({
      success: true,
      data: toFrontendUser(user)
    });
  })
);
router5.patch(
  "/:id/suspend",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (id === res.locals.authUser.id) {
      throw new HttpError(
        400,
        "No pod\xE9s suspender tu propia cuenta"
      );
    }
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!existing) {
      throw new HttpError(
        404,
        "Usuario no encontrado"
      );
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.SUSPENDED
      },
      select: userSelect
    });
    res.json({
      success: true,
      data: toFrontendUser(user)
    });
  })
);
router5.patch(
  "/:id/activate",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!existing) {
      throw new HttpError(
        404,
        "Usuario no encontrado"
      );
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE
      },
      select: userSelect
    });
    res.json({
      success: true,
      data: toFrontendUser(user)
    });
  })
);
var user_routes_default = router5;

// src/routes/index.ts
var router6 = Router10();
router6.use("/users", user_routes_default);
router6.use("/students", studentRouter);
router6.use("/enrollments", enrollmentRouter);
router6.use("/grades", gradeRouter);
router6.use("/class-sections", classSectionRouter);
router6.use("/teacher-assignments", teacherAssignmentRouter);
router6.use("/attendance", attendance_routes_default);
router6.use("/notifications", notification_routes_default);
router6.use("/auth", auth_routes_default);
router6.use("/", course_routes_default);
var routes_default = router6;

// src/app.ts
var app = express2();
app.use(cors());
app.use(express2.json());
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Servidor levantado correctamente"
  });
});
app.use("/api", routes_default);
app.use(errorHandler);
var app_default = app;

// src/entrypoints/vercel.ts
var vercel_default = app_default;
export {
  vercel_default as default
};
