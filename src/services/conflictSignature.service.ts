import { calculateConflictHash } from '@/utils/conflictDocumentHash'
import { Prisma } from '@prisma/client'
import { authenticator } from '@/utils/conflictTotp'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { decryptConflictReport } from '@/utils/conflictEncryption'
import { decryptTotpSecret } from '@/utils/conflictTotpEncryption'

interface SignConflictData {
  conflictId: string
  signerId: string
  totpCode: string
  accepted: boolean
  ipAddress: string
}

type SignResult = {
  conflictId: string
  signatureId: string
  signerId: string
  documentHash: string
  signedAt: Date
  editLocked: true
}

type TransactionResult =
  { ok: true; data: SignResult } | { ok: false; status: number; message: string }

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

export const createSignLegalConflict =
  (db: Pick<typeof prisma, '$transaction'>) =>
  async (data: SignConflictData): Promise<SignResult> => {
    if (!data.accepted) {
      throw new HttpError(400, 'Debés aceptar expresamente la firma del acta')
    }

    if (!/^\d{6}$/.test(data.totpCode)) {
      throw new HttpError(400, 'El código TOTP debe tener seis dígitos')
    }

    const result: TransactionResult = await db.$transaction(
      async (tx): Promise<TransactionResult> => {
        await tx.$queryRaw`
        SELECT "userId"
        FROM "ConflictTotpCredential"
        WHERE "userId" = ${data.signerId}
        FOR UPDATE
      `

        const credential = await tx.conflictTotpCredential.findUnique({
          where: { userId: data.signerId },
        })

        if (!credential?.verifiedAt) {
          throw new HttpError(403, 'Primero debés vincular tu autenticador')
        }

        if (credential.lockedUntil && credential.lockedUntil > new Date()) {
          throw new HttpError(429, 'Autenticador bloqueado temporalmente')
        }

        const secret = decryptTotpSecret(credential.encryptedSecret)
        const delta = authenticator.checkDelta(data.totpCode, secret)

        if (delta === null) {
          const attempts = credential.failedAttempts + 1
          const locked = attempts >= MAX_ATTEMPTS

          await tx.conflictTotpCredential.update({
            where: { userId: data.signerId },
            data: {
              failedAttempts: locked ? 0 : attempts,
              lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          })

          return {
            ok: false,
            status: locked ? 429 : 400,
            message: locked
              ? 'Demasiados intentos. Autenticador bloqueado temporalmente'
              : 'Código TOTP incorrecto',
          }
        }

        const usedStep = BigInt(Math.floor(Date.now() / 30_000) + delta)

        if (credential.lastUsedStep !== null && usedStep <= credential.lastUsedStep) {
          return {
            ok: false,
            status: 409,
            message: 'Este código TOTP ya fue utilizado',
          }
        }

        await tx.$queryRaw`
        SELECT "id"
        FROM "LegalConflict"
        WHERE "id" = ${data.conflictId}
        FOR UPDATE
      `

        const conflict = await tx.legalConflict.findUnique({
          where: { id: data.conflictId },
          include: {
            electronicSignature: true,
          },
        })

        if (!conflict) {
          throw new HttpError(404, 'Acta de conflicto no encontrada')
        }

        if (conflict.authorId !== data.signerId) {
          throw new HttpError(403, 'Solo el autor del acta puede firmarla')
        }

        if (conflict.digitalSignHash || conflict.electronicSignature) {
          throw new HttpError(409, 'El acta ya está firmada')
        }

        const report = decryptConflictReport(conflict.detailedReport)

        const documentHash = calculateConflictHash({
          documentUuid: conflict.documentUuid,
          studentId: conflict.studentId,
          authorId: conflict.authorId,
          conflictCode: conflict.conflictCode,
          detailedReport: report,
          occurrenceDate: conflict.occurrenceDate,
          registeredAt: conflict.registeredAt,
          attachments: [],
        })

        const signature = await tx.conflictElectronicSignature.create({
          data: {
            conflictId: conflict.id,
            signerId: data.signerId,
            documentHash,
          },
        })

        await tx.conflictTotpCredential.update({
          where: { userId: data.signerId },
          data: {
            lastUsedStep: usedStep,
            failedAttempts: 0,
            lockedUntil: null,
          },
        })

        await tx.auditLog.create({
          data: {
            userId: data.signerId,
            action: 'SIGN',
            affectedEntity: 'LegalConflict',
            entityId: conflict.id,
            ipAddress: data.ipAddress,
            newData: {
              signatureId: signature.id,
              documentHash,
              signedAt: signature.signedAt.toISOString(),
              signerId: data.signerId,
            },
          },
        })

        return {
          ok: true,
          data: {
            conflictId: conflict.id,
            signatureId: signature.id,
            signerId: data.signerId,
            documentHash,
            signedAt: signature.signedAt,
            editLocked: true,
          },
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    if (!result.ok) {
      throw new HttpError(result.status, result.message)
    }

    return result.data
  }

export const signLegalConflict = createSignLegalConflict(prisma)
