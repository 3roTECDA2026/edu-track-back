import { prisma } from '../lib/prisma'
import {
  encryptConflictReport,
  decryptConflictReport,
} from '../utils/conflictEncryption'

interface CreateLegalConflictData {
  studentId: string
  authorId: string
  conflictCode: string
  detailedReport: string
  occurrenceDate?: Date
}

export const createLegalConflict = async (
  data: CreateLegalConflictData
) => {
  const encryptedReport = encryptConflictReport(
    data.detailedReport
  )

  const conflict = await prisma.legalConflict.create({
    data: {
      studentId: data.studentId,
      authorId: data.authorId,
      conflictCode: data.conflictCode,
      detailedReport: encryptedReport,
      digitalSignHash: null,
      editLocked: false,
      occurrenceDate: data.occurrenceDate,
    },
  })

  return {
    ...conflict,
    detailedReport: decryptConflictReport(
      conflict.detailedReport
    ),
  }
}

export const getLegalConflictById = async (id: string) => {
  const conflict = await prisma.legalConflict.findUnique({
    where: { id },
  })

  if (!conflict) return null

  return {
    ...conflict,
    detailedReport: decryptConflictReport(
      conflict.detailedReport
    ),
  }
}

export const getLegalConflictsByStudent = async (
  studentId: string
) => {
  const conflicts = await prisma.legalConflict.findMany({
    where: { studentId },
    orderBy: { registeredAt: 'desc' },
  })

  return conflicts.map((conflict) => ({
    ...conflict,
    detailedReport: decryptConflictReport(
      conflict.detailedReport
    ),
  }))
}

// CRM-090: edición y eliminación exclusivamente antes de firmar.

import { Prisma } from '@prisma/client'
import { HttpError } from '@/utils/httpError'

interface UpdateLegalConflictData {
  conflictCode?: string
  detailedReport?: string
  occurrenceDate?: Date | null
}

interface ConflictAuditContext {
  userId: string
  ipAddress: string
}

const lockUnsignedConflict = async (
  tx: Prisma.TransactionClient,
  id: string
) => {
  await tx.$queryRaw`
    SELECT "id"
    FROM "LegalConflict"
    WHERE "id" = ${id}
    FOR UPDATE
  `

  const conflict = await tx.legalConflict.findUnique({
    where: { id },
    include: { electronicSignature: true },
  })

  if (!conflict) {
    throw new HttpError(404, 'Acta de conflicto no encontrada')
  }

  if (
    conflict.editLocked ||
    conflict.digitalSignHash !== null ||
    conflict.electronicSignature !== null
  ) {
    throw new HttpError(409, 'No se puede modificar un acta firmada')
  }

  return conflict
}

export const createLegalConflictMutations = (
  db: Pick<typeof prisma, '$transaction'>
) => {
  const updateLegalConflict = async (
  id: string,
  data: UpdateLegalConflictData,
  audit: ConflictAuditContext
) => {
  return db.$transaction(
    async (tx) => {
      const previous = await lockUnsignedConflict(tx, id)

      const updated = await tx.legalConflict.update({
        where: { id },
        data: {
          ...(data.conflictCode !== undefined && {
            conflictCode: data.conflictCode,
          }),
          ...(data.detailedReport !== undefined && {
            detailedReport: encryptConflictReport(data.detailedReport),
          }),
          ...(data.occurrenceDate !== undefined && {
            occurrenceDate: data.occurrenceDate,
          }),
        },
      })

      await tx.auditLog.create({
        data: {
          userId: audit.userId,
          action: 'UPDATE',
          affectedEntity: 'LegalConflict',
          entityId: id,
          ipAddress: audit.ipAddress,
          previousData: {
            conflictCode: previous.conflictCode,
            occurrenceDate: previous.occurrenceDate?.toISOString() ?? null,
            reportChanged: data.detailedReport !== undefined,
          },
          newData: {
            conflictCode: updated.conflictCode,
            occurrenceDate: updated.occurrenceDate?.toISOString() ?? null,
            reportChanged: data.detailedReport !== undefined,
          },
        },
      })

      return {
        ...updated,
        detailedReport: decryptConflictReport(updated.detailedReport),
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  )
}

const deleteLegalConflict = async (
  id: string,
  audit: ConflictAuditContext
) => {
  return db.$transaction(
    async (tx) => {
      const previous = await lockUnsignedConflict(tx, id)

      // Los anexos dependen del acta y deben eliminarse primero.
      await tx.legalConflictAttachment.deleteMany({
        where: { conflictId: id },
      })

      await tx.legalConflict.delete({
        where: { id },
      })

      await tx.auditLog.create({
        data: {
          userId: audit.userId,
          action: 'DELETE',
          affectedEntity: 'LegalConflict',
          entityId: id,
          ipAddress: audit.ipAddress,
          previousData: {
            studentId: previous.studentId,
            authorId: previous.authorId,
            conflictCode: previous.conflictCode,
            occurrenceDate: previous.occurrenceDate?.toISOString() ?? null,
          },
        },
      })

      return { deleted: true, id }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  )
}

  return { updateLegalConflict, deleteLegalConflict }
}

export const {
  updateLegalConflict,
  deleteLegalConflict,
} = createLegalConflictMutations(prisma)
