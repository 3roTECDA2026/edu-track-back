import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { encryptConflictReport, decryptConflictReport } from '@/utils/conflictEncryption'

interface CreateLegalConflictData {
  studentId: string
  authorId: string
  conflictCode: string
  detailedReport: string
  occurrenceDate?: Date
}

export const createLegalConflict = async (data: CreateLegalConflictData) => {
  const [student, conflictCode] = await Promise.all([
    prisma.student.findUnique({
      where: { id: data.studentId },
      select: { id: true },
    }),
    prisma.conflictCode.findUnique({
      where: { code: data.conflictCode },
      select: { code: true },
    }),
  ])

  if (!student) {
    throw new HttpError(404, 'El alumno indicado no existe')
  }

  if (!conflictCode) {
    throw new HttpError(400, 'El código de conflicto no es válido')
  }

  const encryptedReport = encryptConflictReport(data.detailedReport)

  const conflict = await prisma.legalConflict.create({
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

  return {
    ...conflict,
    detailedReport: decryptConflictReport(conflict.detailedReport),
  }
}

export const getLegalConflictById = async (id: string) => {
  const conflict = await prisma.legalConflict.findUnique({
    where: { id },
    include: {
      attachments: {
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!conflict) return null

  const authorIds = [...new Set(conflict.attachments.map((a) => a.authorId))]

  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, firstName: true, lastName: true },
  })

  const authorsById = new Map(authors.map((author) => [author.id, author]))

  return {
    ...conflict,
    detailedReport: decryptConflictReport(conflict.detailedReport),
    attachments: conflict.attachments.map((attachment) => ({
      ...attachment,
      content: decryptConflictReport(attachment.content),
      author: authorsById.get(attachment.authorId) ?? null,
    })),
  }
}

export const getLegalConflictsByStudent = async (studentId: string) => {
  const conflicts = await prisma.legalConflict.findMany({
    where: { studentId },
    orderBy: { registeredAt: 'desc' },
  })

  return conflicts.map((conflict) => ({
    ...conflict,
    detailedReport: decryptConflictReport(conflict.detailedReport),
  }))
}
