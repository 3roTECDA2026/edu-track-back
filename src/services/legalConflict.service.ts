import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { encryptConflictReport, decryptConflictReport } from '@/utils/conflictEncryption'

interface CreateLegalConflictData {
  studentId: string
  authorId: string
  conflictCode: string
  detailedReport: string
  occurrenceDate?: Date
  ipAddress: string
}

type ConflictDatabase = Pick<typeof prisma, '$transaction'>

export const createLegalConflict = async (
  data: CreateLegalConflictData,
  db: ConflictDatabase = prisma
) => {
  return db.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: data.studentId },
      select: { id: true },
    })

    if (!student) {
      throw new HttpError(404, 'El alumno indicado no existe')
    }

    const conflictCode = await tx.conflictCode.findUnique({
      where: { code: data.conflictCode },
      select: { code: true },
    })

    if (!conflictCode) {
      throw new HttpError(400, 'El código de conflicto no es válido')
    }

    const encryptedReport = encryptConflictReport(data.detailedReport)

    const conflict = await tx.legalConflict.create({
      data: {
        studentId: data.studentId,
        authorId: data.authorId,
        conflictCode: data.conflictCode,
        detailedReport: encryptedReport,
        digitalSignHash: null,
        editLocked: true,
        occurrenceDate: data.occurrenceDate,
      },
    })

    // E4-RNF-03: el log guarda solo referencias, nunca el contenido del informe.
    await tx.auditLog.create({
      data: {
        userId: data.authorId,
        action: 'CREATE',
        affectedEntity: 'LegalConflict',
        entityId: conflict.id,
        ipAddress: data.ipAddress,
        newData: {
          conflictId: conflict.id,
          studentId: data.studentId,
          conflictCode: data.conflictCode,
          authorId: data.authorId,
        },
      },
    })

    return {
      ...conflict,
      detailedReport: decryptConflictReport(conflict.detailedReport),
    }
  })
}

interface AccessContext {
  userId: string
  ipAddress: string
}

export const getLegalConflictById = async (
  id: string,
  access: AccessContext,
  db: ConflictDatabase = prisma
) => {
  return db.$transaction(async (tx) => {
    const conflict = await tx.legalConflict.findUnique({
      where: { id },
      include: {
        attachments: {
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        },
      },
    })

    if (!conflict) return null

    const authorIds = [...new Set(conflict.attachments.map((a) => a.authorId))]

    const authors = await tx.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true },
    })

    const authorsById = new Map(authors.map((author) => [author.id, author]))

    // E4-RNF-03: se registra quién vio el detalle, sin guardar su contenido.
    await tx.auditLog.create({
      data: {
        userId: access.userId,
        action: 'SENSITIVE_VIEW',
        affectedEntity: 'LegalConflict',
        entityId: conflict.id,
        ipAddress: access.ipAddress,
        newData: { operation: 'VIEW', conflictId: conflict.id },
      },
    })

    return {
      ...conflict,
      detailedReport: decryptConflictReport(conflict.detailedReport),
      attachments: conflict.attachments.map((attachment) => ({
        ...attachment,
        content: decryptConflictReport(attachment.content),
        author: authorsById.get(attachment.authorId) ?? null,
      })),
    }
  })
}

export const getLegalConflictsByStudent = async (
  studentId: string,
  access: AccessContext,
  db: ConflictDatabase = prisma
) => {
  return db.$transaction(async (tx) => {
    const conflicts = await tx.legalConflict.findMany({
      where: { studentId },
      orderBy: { registeredAt: 'desc' },
    })

    // Un solo log por listado, con la referencia del alumno y la cantidad de resultados.
    await tx.auditLog.create({
      data: {
        userId: access.userId,
        action: 'SENSITIVE_VIEW',
        affectedEntity: 'LegalConflict',
        ipAddress: access.ipAddress,
        newData: { operation: 'LIST', studentId, total: conflicts.length },
      },
    })

    return conflicts.map((conflict) => ({
      ...conflict,
      detailedReport: decryptConflictReport(conflict.detailedReport),
    }))
  })
}
