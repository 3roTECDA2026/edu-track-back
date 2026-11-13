import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { authenticator } from 'otplib'
import { createStartTotpEnrollment } from '../src/services/conflictTotp.service'
import { decryptTotpSecret } from '../src/utils/conflictTotpEncryption'

process.env.CONFLICT_ENCRYPTION_KEY = randomBytes(32).toString('hex')

function createFixture(verified = false) {
  const userId = 'usuario-1'
  const state: {
    credential: {
      userId: string
      encryptedSecret: string
      verifiedAt: Date | null
      lastUsedStep: bigint | null
      failedAttempts: number
      lockedUntil: Date | null
    } | null
    creates: number
    updates: number
  } = {
    credential: null,
    creates: 0,
    updates: 0,
  }

  const tx = {
    $queryRaw: async () => [{ id: userId }],
    conflictTotpCredential: {
      findUnique: async () => state.credential,
      create: async ({ data }: any) => {
        state.creates++
        state.credential = {
          ...data,
          verifiedAt: null,
          lastUsedStep: null,
          failedAttempts: 0,
          lockedUntil: null,
        }
        return state.credential
      },
      update: async ({ data }: any) => {
        state.updates++
        state.credential = { ...state.credential!, ...data }
        return state.credential
      },
    },
  }

  const db = {
    user: {
      findUnique: async () => ({ email: 'directivo@ejemplo.com' }),
    },
    $transaction: async (callback: any) => callback(tx),
  }

  const enroll = createStartTotpEnrollment(db as any)

  async function setupVerifiedCredential() {
    await enroll(userId)
    state.credential!.verifiedAt = new Date()
  }

  return { userId, state, enroll, setupVerifiedCredential, verified }
}

test('permite generar un QR por primera vez', async () => {
  const { userId, state, enroll } = createFixture()

  const result = await enroll(userId)

  assert.ok(result.otpauthUri.startsWith('otpauth://totp/'))
  assert.ok(result.secret)
  assert.equal(state.creates, 1)
  assert.equal(state.updates, 0)
  assert.equal(decryptTotpSecret(state.credential!.encryptedSecret), result.secret)
})

test('permite regenerar el QR de una vinculación pendiente', async () => {
  const { userId, state, enroll } = createFixture()

  const first = await enroll(userId)
  const second = await enroll(userId)

  assert.notEqual(first.secret, second.secret)
  assert.equal(state.creates, 1)
  assert.equal(state.updates, 1)
  assert.equal(decryptTotpSecret(state.credential!.encryptedSecret), second.secret)
})

test('impide reemplazar un autenticador confirmado', async () => {
  const { userId, state, enroll, setupVerifiedCredential } = createFixture()

  await setupVerifiedCredential()
  const previousSecret = state.credential!.encryptedSecret

  await assert.rejects(enroll(userId), /El autenticador ya está vinculado/)

  assert.equal(state.credential!.encryptedSecret, previousSecret)
  assert.equal(state.updates, 0)
})

test('invalida el QR anterior al regenerar una vinculación pendiente', async () => {
  const { userId, state, enroll } = createFixture()

  const first = await enroll(userId)
  const second = await enroll(userId)

  const activeSecret = decryptTotpSecret(state.credential!.encryptedSecret)

  assert.equal(activeSecret, second.secret)
  assert.notEqual(activeSecret, first.secret)

  const newCode = authenticator.generate(second.secret)
  assert.equal(authenticator.check(newCode, activeSecret), true)
})
