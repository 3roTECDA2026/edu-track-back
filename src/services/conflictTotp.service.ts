import { authenticator } from '@/utils/conflictTotp'
import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'
import { generateTotpSecret, generateTotpUri } from '@/utils/conflictTotp'
import { encryptTotpSecret, decryptTotpSecret } from '@/utils/conflictTotpEncryption'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

export const createStartTotpEnrollment = (db: typeof prisma) => async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!user) {
    throw new HttpError(404, 'Usuario no encontrado')
  }

  const secret = generateTotpSecret()
  const encryptedSecret = encryptTotpSecret(secret)

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    `

    const existing = await tx.conflictTotpCredential.findUnique({
      where: { userId },
    })

    if (existing?.verifiedAt) {
      return { ok: false as const }
    }

    if (existing) {
      await tx.conflictTotpCredential.update({
        where: { userId },
        data: {
          encryptedSecret,
          verifiedAt: null,
          lastUsedStep: null,
          failedAttempts: 0,
          lockedUntil: null,
        },
      })
    } else {
      await tx.conflictTotpCredential.create({
        data: {
          userId,
          encryptedSecret,
        },
      })
    }

    return { ok: true as const }
  })

  if (!result.ok) {
    throw new HttpError(409, 'El autenticador ya está vinculado')
  }

  return {
    otpauthUri: generateTotpUri(user.email, secret),
    secret,
  }
}

export const startTotpEnrollment = createStartTotpEnrollment(prisma)

export const confirmTotpEnrollment = async (userId: string, code: string) => {
  if (!/^\d{6}$/.test(code)) {
    throw new HttpError(400, 'El código debe contener seis dígitos')
  }

  const result = await prisma.$transaction(async (tx) => {
    // Mantener el orden: primero usuario, después credencial.
    await tx.$queryRaw`
      SELECT "id"
      FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    `

    await tx.$queryRaw`
      SELECT "userId"
      FROM "ConflictTotpCredential"
      WHERE "userId" = ${userId}
      FOR UPDATE
    `

    const credential = await tx.conflictTotpCredential.findUnique({
      where: { userId },
    })

    if (!credential) {
      return {
        ok: false as const,
        status: 404,
        message: 'Primero debés iniciar la vinculación',
      }
    }

    if (credential.verifiedAt) {
      return {
        ok: false as const,
        status: 409,
        message: 'El autenticador ya está vinculado',
      }
    }

    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      return {
        ok: false as const,
        status: 429,
        message: 'Demasiados intentos. Probá más tarde',
      }
    }

    const secret = decryptTotpSecret(credential.encryptedSecret)
    const delta = authenticator.checkDelta(code, secret)

    if (delta === null) {
      const attempts = credential.failedAttempts + 1
      const locked = attempts >= MAX_ATTEMPTS

      await tx.conflictTotpCredential.update({
        where: { userId },
        data: {
          failedAttempts: locked ? 0 : attempts,
          lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      })

      return {
        ok: false as const,
        status: locked ? 429 : 400,
        message: locked
          ? 'Demasiados intentos. Probá más tarde'
          : 'Código de autenticación incorrecto',
      }
    }

    const usedStep = BigInt(Math.floor(Date.now() / 30_000) + delta)

    await tx.conflictTotpCredential.update({
      where: { userId },
      data: {
        verifiedAt: new Date(),
        lastUsedStep: usedStep,
        failedAttempts: 0,
        lockedUntil: null,
      },
    })

    return {
      ok: true as const,
      enabled: true,
    }
  })

  if (!result.ok) {
    throw new HttpError(result.status, result.message)
  }

  return { enabled: result.enabled }
}
