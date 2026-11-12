import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  requestTotpRecovery,
  approveTotpRecovery,
} from '../src/services/conflictTotpRecovery.service'

test('rechaza una solicitud de recuperación sin motivo suficiente', async () => {
  await assert.rejects(
    requestTotpRecovery({
      userId: 'usuario-de-prueba',
      reason: 'Perdí',
      ipAddress: '127.0.0.1',
    }),
    /El motivo debe tener entre 10 y 1000 caracteres/
  )
})

test('rechaza una aprobación sin confirmación de identidad', async () => {
  await assert.rejects(
    approveTotpRecovery({
      recoveryId: 'solicitud-de-prueba',
      approverId: 'directivo-de-prueba',
      password: 'contraseña-de-prueba',
      identityVerified: false,
      verificationMethod: 'IN_PERSON',
      ipAddress: '127.0.0.1',
    }),
    /Debés confirmar la verificación independiente de identidad/
  )
})

import bcrypt from 'bcrypt'
import { Role, UserStatus } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { createApproveTotpRecovery } from '../src/services/conflictTotpRecovery.service'

const approverId = 'directivo-1'
const titularId = 'titular-1'

const makeRecovery = (overrides: Record<string, unknown> = {}) => ({
  id: 'solicitud-1',
  userId: titularId,
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 60_000),
  ...overrides,
})

const makeApprovalDb = (
  passwordHash: string,
  recoveryOverrides: Record<string, unknown> = {},
  auditFails = false
) => {
  let deleted = 0
  let audited = 0
  let failedAttempts = 0
  let lockedUntil: Date | null = null

  const approver = {
    role: Role.SCHOOL_MANAGEMENT,
    status: UserStatus.ACTIVE,
    passwordHash,
  }

  const tx = {
    $queryRaw: async () => [{ id: 'solicitud-1' }],
    conflictTotpRecoveryAttempt: {
      findUnique: async () =>
        failedAttempts > 0 || lockedUntil
          ? { userId: approverId, failedAttempts, lockedUntil }
          : null,
      upsert: async ({
        create,
        update,
      }: {
        create: { failedAttempts: number; lockedUntil: Date | null }
        update: { failedAttempts: number; lockedUntil: Date | null }
      }) => {
        const data = failedAttempts > 0 || lockedUntil ? update : create

        failedAttempts = data.failedAttempts
        lockedUntil = data.lockedUntil
        return { userId: approverId, failedAttempts, lockedUntil }
      },
      update: async ({ data }: { data: { failedAttempts: number; lockedUntil: Date | null } }) => {
        failedAttempts = data.failedAttempts
        lockedUntil = data.lockedUntil
        return { userId: approverId, failedAttempts, lockedUntil }
      },
      updateMany: async ({
        data,
      }: {
        data: { failedAttempts: number; lockedUntil: Date | null }
      }) => {
        failedAttempts = data.failedAttempts
        lockedUntil = data.lockedUntil
        return { count: 1 }
      },
    },
    conflictTotpRecovery: {
      findUnique: async () => makeRecovery(recoveryOverrides),
      update: async () => ({
        id: 'solicitud-1',
        status: 'APPROVED',
        approvedAt: new Date(),
      }),
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === approverId
          ? approver
          : { role: Role.EOE_DIRECTIVE, status: UserStatus.ACTIVE },
    },
    conflictTotpCredential: {
      deleteMany: async () => {
        deleted++
        return { count: 1 }
      },
    },
    auditLog: {
      create: async () => {
        if (auditFails) throw new Error('Fallo de auditoría')
        audited++
        return { id: 'audit-1' }
      },
    },
  }

  const db = {
    user: {
      findUnique: async () => approver,
    },
    $transaction: async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx),
  }

  return {
    db: db as unknown as PrismaClient,
    counts: () => ({ deleted, audited }),
    expireLock: () => {
      lockedUntil = new Date(Date.now() - 1000)
    },
  }
}

const approvalInput = {
  recoveryId: 'solicitud-1',
  approverId,
  password: 'ClaveCorrecta123!',
  identityVerified: true,
  verificationMethod: 'IN_PERSON' as const,
  ipAddress: '127.0.0.1',
}

test('rechaza un método de verificación de identidad inválido', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts } = makeApprovalDb(hash)
  const approve = createApproveTotpRecovery(db)

  await assert.rejects(
    approve({
      ...approvalInput,
      verificationMethod: 'REMOTE' as 'IN_PERSON',
    }),
    /Debés confirmar la verificación independiente de identidad/
  )

  assert.deepEqual(counts(), { deleted: 0, audited: 0 })
})

test('rechaza contraseña incorrecta sin invalidar TOTP', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts } = makeApprovalDb(hash)
  const approve = createApproveTotpRecovery(db)

  await assert.rejects(
    approve({ ...approvalInput, password: 'Incorrecta' }),
    /Credenciales inválidas/
  )

  assert.deepEqual(counts(), { deleted: 0, audited: 0 })
})

test('rechaza la autoaprobación sin invalidar TOTP', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts } = makeApprovalDb(hash, { userId: approverId })
  const approve = createApproveTotpRecovery(db)

  await assert.rejects(approve(approvalInput), /No podés aprobar tu propia recuperación/)

  assert.deepEqual(counts(), { deleted: 0, audited: 0 })
})

test('rechaza solicitudes vencidas sin invalidar TOTP', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts } = makeApprovalDb(hash, {
    expiresAt: new Date(Date.now() - 60_000),
  })
  const approve = createApproveTotpRecovery(db)

  await assert.rejects(approve(approvalInput), /La solicitud ya no está vigente/)

  assert.deepEqual(counts(), { deleted: 0, audited: 0 })
})

test('autoriza recuperación válida y registra auditoría', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts } = makeApprovalDb(hash)
  const approve = createApproveTotpRecovery(db)

  const result = await approve(approvalInput)

  assert.equal(result.status, 'APPROVED')
  assert.deepEqual(counts(), { deleted: 1, audited: 1 })
})

test('propaga un fallo de auditoría durante la aprobación', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db } = makeApprovalDb(hash, {}, true)
  const approve = createApproveTotpRecovery(db)

  await assert.rejects(approve(approvalInput), /Fallo de auditoría/)
})

test('bloquea la recuperación después de cinco contraseñas incorrectas', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts } = makeApprovalDb(hash)
  const approve = createApproveTotpRecovery(db)

  for (let attempt = 1; attempt <= 4; attempt++) {
    await assert.rejects(
      approve({ ...approvalInput, password: 'Incorrecta' }),
      /Credenciales inválidas/
    )
  }

  // El quinto intento activa el bloqueo.
  await assert.rejects(approve({ ...approvalInput, password: 'Incorrecta' }), /Demasiados intentos/)

  // Una contraseña correcta tampoco debe saltarse el bloqueo.
  await assert.rejects(approve(approvalInput), /Demasiados intentos/)

  // Nunca se invalidó la credencial ni se aprobó la solicitud.
  assert.deepEqual(counts(), { deleted: 0, audited: 0 })
})

test('una contraseña correcta reinicia los intentos anteriores', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts } = makeApprovalDb(hash)
  const approve = createApproveTotpRecovery(db)

  for (let attempt = 0; attempt < 4; attempt++) {
    await assert.rejects(
      approve({ ...approvalInput, password: 'Incorrecta' }),
      /Credenciales inválidas/
    )
  }

  // Una aprobación válida reinicia el contador.
  const result = await approve(approvalInput)
  assert.equal(result.status, 'APPROVED')

  // El siguiente error debe contarse como primer intento, no como quinto.
  await assert.rejects(
    approve({ ...approvalInput, password: 'Incorrecta' }),
    /Credenciales inválidas/
  )

  assert.deepEqual(counts(), { deleted: 1, audited: 1 })
})

test('permite volver a intentar después de vencer el bloqueo', async () => {
  const hash = await bcrypt.hash('ClaveCorrecta123!', 4)
  const { db, counts, expireLock } = makeApprovalDb(hash)
  const approve = createApproveTotpRecovery(db)

  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(
      approve({ ...approvalInput, password: 'Incorrecta' }),
      attempt === 4 ? /Demasiados intentos/ : /Credenciales inválidas/
    )
  }

  // Simulamos que pasaron los 15 minutos.
  expireLock()

  // Un nuevo error debe ser el primer intento del siguiente período.
  await assert.rejects(
    approve({ ...approvalInput, password: 'Incorrecta' }),
    /Credenciales inválidas/
  )

  // La contraseña correcta vuelve a estar permitida.
  const result = await approve(approvalInput)

  assert.equal(result.status, 'APPROVED')
  assert.deepEqual(counts(), { deleted: 1, audited: 1 })
})
