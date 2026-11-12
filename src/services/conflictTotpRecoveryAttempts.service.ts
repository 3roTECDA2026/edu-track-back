import { prisma } from '@/lib/prisma'
import { HttpError } from '@/utils/httpError'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

export const registerRecoveryPasswordAttempt = async (
  userId: string,
  passwordValid: boolean,
  db: typeof prisma = prisma
): Promise<void> => {
  const blocked = await db.$transaction(async (tx) => {
    // Bloquear la fila del usuario para serializar los intentos.
    await tx.$queryRaw`
      SELECT "id" FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    `

    const now = new Date()

    const current = await tx.conflictTotpRecoveryAttempt.findUnique({
      where: { userId },
    })

    if (current?.lockedUntil && current.lockedUntil > now) {
      return true
    }

    if (passwordValid) {
      // Comprobar el bloqueo sin reiniciar todavía el contador.
      // Se reiniciará únicamente después de una aprobación válida.
      return false
    }

    const previousAttempts =
      current?.lockedUntil && current.lockedUntil <= now ? 0 : (current?.failedAttempts ?? 0)

    const attempts = previousAttempts + 1
    const mustLock = attempts >= MAX_ATTEMPTS

    const lockedUntil = mustLock ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000) : null

    await tx.conflictTotpRecoveryAttempt.upsert({
      where: { userId },
      create: {
        userId,
        failedAttempts: mustLock ? 0 : attempts,
        lockedUntil,
      },
      update: {
        failedAttempts: mustLock ? 0 : attempts,
        lockedUntil,
      },
    })

    return mustLock
  })

  if (blocked) {
    throw new HttpError(429, 'Demasiados intentos. Esperá 15 minutos para volver a intentar')
  }

  if (!passwordValid) {
    throw new HttpError(401, 'Credenciales inválidas')
  }
}
