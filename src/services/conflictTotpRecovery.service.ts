import bcrypt from 'bcrypt'
import { Prisma, Role, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { registerRecoveryPasswordAttempt } from '@/services/conflictTotpRecoveryAttempts.service'

const RECOVERY_HOURS = 24

type RequestRecoveryInput = {
  userId: string
  reason: string
  ipAddress: string
}

type ApproveRecoveryInput = {
  recoveryId: string
  approverId: string
  password: string
  identityVerified: boolean
  verificationMethod: 'IN_PERSON'
  ipAddress: string
}

export const createRequestTotpRecovery =
  (db: typeof prisma) =>
  async ({ userId, reason, ipAddress }: RequestRecoveryInput) => {
    const cleanReason = reason.trim()

    if (cleanReason.length < 10 || cleanReason.length > 1000) {
      throw new HttpError(400, 'El motivo debe tener entre 10 y 1000 caracteres')
    }

    return db.$transaction(async (tx) => {
      // Serializar solicitudes del mismo titular.
      await tx.$queryRaw`
      SELECT "id" FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    `

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      })

      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        !([Role.EOE_DIRECTIVE, Role.SCHOOL_MANAGEMENT] as Role[]).includes(user.role)
      ) {
        throw new HttpError(403, 'Usuario no autorizado')
      }

      const credential = await tx.conflictTotpCredential.findUnique({
        where: { userId },
        select: { verifiedAt: true },
      })

      if (!credential?.verifiedAt) {
        throw new HttpError(409, 'No hay un autenticador confirmado para recuperar')
      }

      const now = new Date()

      // Cerrar solicitudes anteriores que ya vencieron.
      await tx.conflictTotpRecovery.updateMany({
        where: {
          userId,
          status: 'PENDING',
          expiresAt: { lte: now },
        },
        data: { status: 'REJECTED' },
      })

      const pending = await tx.conflictTotpRecovery.findFirst({
        where: { userId, status: 'PENDING' },
        select: { id: true },
      })

      if (pending) {
        throw new HttpError(409, 'Ya existe una solicitud pendiente')
      }

      const expiresAt = new Date(now.getTime() + RECOVERY_HOURS * 60 * 60 * 1000)

      const recovery = await tx.conflictTotpRecovery.create({
        data: {
          userId,
          reason: cleanReason,
          expiresAt,
        },
      })

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          affectedEntity: 'ConflictTotpRecovery',
          entityId: recovery.id,
          ipAddress,
          newData: {
            status: 'PENDING',
            expiresAt: expiresAt.toISOString(),
          },
        },
      })

      return {
        id: recovery.id,
        status: recovery.status,
        expiresAt: recovery.expiresAt,
      }
    })
  }

export const createApproveTotpRecovery =
  (db: typeof prisma) =>
  async ({
    recoveryId,
    approverId,
    password,
    identityVerified,
    verificationMethod,
    ipAddress,
  }: ApproveRecoveryInput) => {
    if (!identityVerified || verificationMethod !== 'IN_PERSON') {
      throw new HttpError(400, 'Debés confirmar la verificación independiente de identidad')
    }

    const approver = await db.user.findUnique({
      where: { id: approverId },
      select: {
        role: true,
        status: true,
        passwordHash: true,
      },
    })

    if (
      !approver ||
      approver.role !== Role.SCHOOL_MANAGEMENT ||
      approver.status !== UserStatus.ACTIVE
    ) {
      throw new HttpError(403, 'Solo otro directivo activo puede autorizar')
    }

    const validPassword = await bcrypt.compare(password, approver.passwordHash)

    await registerRecoveryPasswordAttempt(approverId, validPassword, db)

    return db.$transaction(
      async (tx) => {
        // Consultar el titular antes de adquirir bloqueos.
        // La solicitud se bloqueará después de los usuarios.
        const recoveryOwner = await tx.conflictTotpRecovery.findUnique({
          where: { id: recoveryId },
          select: { userId: true },
        })

        if (!recoveryOwner) {
          throw new HttpError(404, 'Solicitud no encontrada')
        }

        if (recoveryOwner.userId === approverId) {
          throw new HttpError(403, 'No podés aprobar tu propia recuperación')
        }

        // Orden fijo para evitar bloqueos circulares entre directivos.
        const userIds = [approverId, recoveryOwner.userId].sort()

        for (const userId of userIds) {
          await tx.$queryRaw`
        SELECT "id" FROM "User"
        WHERE "id" = ${userId}
        FOR UPDATE
      `
        }

        const attemptState = await tx.conflictTotpRecoveryAttempt.findUnique({
          where: { userId: approverId },
          select: { lockedUntil: true },
        })

        if (attemptState?.lockedUntil && attemptState.lockedUntil > new Date()) {
          throw new HttpError(429, 'Demasiados intentos. Esperá 15 minutos para volver a intentar')
        }

        // Bloquear la solicitud después de bloquear los usuarios.
        await tx.$queryRaw`
      SELECT "id" FROM "ConflictTotpRecovery"
      WHERE "id" = ${recoveryId}
      FOR UPDATE
    `

        const recovery = await tx.conflictTotpRecovery.findUnique({
          where: { id: recoveryId },
        })

        if (!recovery) {
          throw new HttpError(404, 'Solicitud no encontrada')
        }

        if (recovery.userId !== recoveryOwner.userId) {
          throw new HttpError(409, 'La solicitud cambió durante la aprobación')
        }

        if (recovery.status !== 'PENDING' || recovery.expiresAt.getTime() <= Date.now()) {
          throw new HttpError(409, 'La solicitud ya no está vigente')
        }

        const target = await tx.user.findUnique({
          where: { id: recovery.userId },
          select: { role: true, status: true },
        })

        const currentApprover = await tx.user.findUnique({
          where: { id: approverId },
          select: { role: true, status: true, passwordHash: true },
        })

        if (
          !target ||
          target.status !== UserStatus.ACTIVE ||
          !([Role.EOE_DIRECTIVE, Role.SCHOOL_MANAGEMENT] as Role[]).includes(target.role) ||
          !currentApprover ||
          currentApprover.role !== Role.SCHOOL_MANAGEMENT ||
          currentApprover.status !== UserStatus.ACTIVE ||
          currentApprover.passwordHash !== approver.passwordHash
        ) {
          throw new HttpError(403, 'La autorización ya no es válida')
        }

        // Invalidar el autenticador anterior, sin tocar las firmas existentes.
        const deleted = await tx.conflictTotpCredential.deleteMany({
          where: {
            userId: recovery.userId,
            verifiedAt: { not: null },
          },
        })

        if (deleted.count !== 1) {
          throw new HttpError(409, 'La credencial ya no está disponible')
        }

        const approvedAt = new Date()

        const updated = await tx.conflictTotpRecovery.update({
          where: { id: recoveryId },
          data: {
            status: 'APPROVED',
            approvedById: approverId,
            approvedAt,
          },
        })

        await tx.auditLog.create({
          data: {
            userId: approverId,
            action: 'UPDATE',
            affectedEntity: 'ConflictTotpRecovery',
            entityId: recoveryId,
            ipAddress,
            previousData: {
              status: 'PENDING',
            },
            newData: {
              status: 'APPROVED',
              targetUserId: recovery.userId,
              approvedById: approverId,
              identityVerified: true,
              verificationMethod,
              approvedAt: approvedAt.toISOString(),
              credentialInvalidated: true,
            },
          },
        })

        // Reiniciar los intentos solo cuando la aprobación
        // y el registro de auditoría se completaron correctamente.
        await tx.conflictTotpRecoveryAttempt.updateMany({
          where: { userId: approverId },
          data: {
            failedAttempts: 0,
            lockedUntil: null,
          },
        })

        return {
          id: updated.id,
          status: updated.status,
          approvedAt: updated.approvedAt,
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )
  }

// Aplicación: utiliza Prisma real.
// Tests: permiten inyectar un cliente simulado.
export const requestTotpRecovery = createRequestTotpRecovery(prisma)
export const approveTotpRecovery = createApproveTotpRecovery(prisma)
