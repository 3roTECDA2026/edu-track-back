import { randomUUID } from 'node:crypto'

import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { calculateConflictDeadline } from '@/utils/conflictDeadline'
import {
  assertConflictEncryptionKey,
  decryptConflictReport,
  encryptConflictReport,
} from '@/utils/conflictEncryption'
import {
  calculateAttachmentHash,
  calculateConflictHash,
  calculateConflictRecordHash,
} from '@/utils/conflictDocumentHash'
import {
  auditLogHash,
  evaluateIntegrity,
  evaluateSignature,
  overallIntegrity,
} from '@/utils/conflictIntegrity'

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

    // CRM-093: el UUID y la fecha se fijan acá (y no con los default de la base) porque el hash
    // se calcula con esos valores antes de guardar.
    const documentUuid = randomUUID()
    const registeredAt = new Date()
    const digitalSignHash = calculateConflictRecordHash({
      documentUuid,
      studentId: data.studentId,
      authorId: data.authorId,
      conflictCode: data.conflictCode,
      detailedReport: data.detailedReport,
      occurrenceDate: data.occurrenceDate ?? null,
      registeredAt,
    })

    const conflict = await tx.legalConflict.create({
      data: {
        documentUuid,
        registeredAt,
        studentId: data.studentId,
        authorId: data.authorId,
        conflictCode: data.conflictCode,
        detailedReport: encryptedReport,
        digitalSignHash,
        editLocked: true,
        occurrenceDate: data.occurrenceDate,
      },
    })

    // E4-RNF-03: el log guarda solo referencias, nunca el contenido del informe.
    // CRM-093: también el hash. El AuditLog no se puede modificar (CRM-095), así que queda una
    // copia independiente para la verificación.
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
          documentUuid,
          digitalSignHash,
        },
      },
    })

    return {
      ...conflict,
      detailedReport: decryptConflictReport(conflict.detailedReport),
      ...calculateConflictDeadline(conflict.occurrenceDate, conflict.registeredAt),
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
      ...calculateConflictDeadline(conflict.occurrenceDate, conflict.registeredAt),
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
      ...calculateConflictDeadline(conflict.occurrenceDate, conflict.registeredAt),
    }))
  })
}

// Descifra el contenido; null si no se puede (el tag de AES-GCM no coincide: fue manipulado).
const tryDecrypt = (encrypted: string): string | null => {
  try {
    return decryptConflictReport(encrypted)
  } catch {
    return null
  }
}

// CRM-093 (E4-RF-17): recalcula los hashes del acta y de cada anexo y responde si están íntegros.
// Compara contra el hash guardado en el registro, contra la copia del AuditLog del alta y, si el
// acta está firmada, contra el documentHash de la firma TOTP.
export const verifyLegalConflict = async (
  id: string,
  access: AccessContext,
  db: ConflictDatabase = prisma
) => {
  // Sin la clave de cifrado no se puede descifrar nada: es un error de configuración (500), no
  // un acta alterada.
  assertConflictEncryptionKey()

  return db.$transaction(async (tx) => {
    const conflict = await tx.legalConflict.findUnique({
      where: { id },
      include: {
        attachments: { orderBy: [{ date: 'asc' }, { id: 'asc' }] },
        electronicSignature: true,
      },
    })

    if (!conflict) return null

    const attachmentIds = conflict.attachments.map((attachment) => attachment.id)
    const creationLogs = await tx.auditLog.findMany({
      where: {
        action: 'CREATE',
        OR: [
          { affectedEntity: 'LegalConflict', entityId: conflict.id },
          { affectedEntity: 'LegalConflictAttachment', entityId: { in: attachmentIds } },
        ],
      },
      orderBy: { timestamp: 'asc' },
      select: { affectedEntity: true, entityId: true, newData: true },
    })
    // El primer log de alta de cada registro
    const auditHashes = new Map<string, string | null>()
    for (const log of creationLogs) {
      const key = `${log.affectedEntity}:${log.entityId}`
      if (!auditHashes.has(key)) auditHashes.set(key, auditLogHash(log.newData))
    }

    const report = tryDecrypt(conflict.detailedReport)
    const conflictData = {
      documentUuid: conflict.documentUuid,
      studentId: conflict.studentId,
      authorId: conflict.authorId,
      conflictCode: conflict.conflictCode,
      occurrenceDate: conflict.occurrenceDate,
      registeredAt: conflict.registeredAt,
    }
    const calculatedHash =
      report === null
        ? null
        : calculateConflictRecordHash({ ...conflictData, detailedReport: report })
    const conflictIntegrity = evaluateIntegrity({
      storedHash: conflict.digitalSignHash,
      auditHash: auditHashes.get(`LegalConflict:${conflict.id}`) ?? null,
      calculatedHash,
    })

    const signatureStatus = evaluateSignature(
      conflict.electronicSignature?.documentHash ?? null,
      report === null
        ? null
        : calculateConflictHash({ ...conflictData, detailedReport: report, attachments: [] })
    )

    const attachments = conflict.attachments.map((attachment) => {
      const content = tryDecrypt(attachment.content)
      const integrity = evaluateIntegrity({
        storedHash: attachment.digitalSignHash,
        auditHash: auditHashes.get(`LegalConflictAttachment:${attachment.id}`) ?? null,
        calculatedHash:
          content === null
            ? null
            : calculateAttachmentHash({
                documentUuid: attachment.documentUuid,
                conflictId: attachment.conflictId,
                authorId: attachment.authorId,
                content,
                date: attachment.date,
              }),
      })
      return { id: attachment.id, documentUuid: attachment.documentUuid, ...integrity }
    })

    const status = overallIntegrity(
      [conflictIntegrity.status, ...attachments.map((attachment) => attachment.status)],
      signatureStatus
    )

    // E4-RNF-03: verificar descifra el informe, así que queda registrado (sin el contenido).
    await tx.auditLog.create({
      data: {
        userId: access.userId,
        action: 'SENSITIVE_VIEW',
        affectedEntity: 'LegalConflict',
        entityId: conflict.id,
        ipAddress: access.ipAddress,
        newData: {
          operation: 'VERIFY',
          conflictId: conflict.id,
          status,
          signature: signatureStatus,
          alteredAttachments: attachments
            .filter((attachment) => attachment.status === 'ALTERED')
            .map((attachment) => attachment.id),
        },
      },
    })

    return {
      conflictId: conflict.id,
      documentUuid: conflict.documentUuid,
      status,
      storedHash: conflict.digitalSignHash,
      calculatedHash,
      reasons: conflictIntegrity.reasons,
      conflictStatus: conflictIntegrity.status,
      signature: {
        status: signatureStatus,
        signedAt: conflict.electronicSignature?.signedAt ?? null,
      },
      attachments,
      verifiedAt: new Date(),
    }
  })
}
