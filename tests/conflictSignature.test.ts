import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import { authenticator } from 'otplib'
import { createSignLegalConflict } from '../src/services/conflictSignature.service'
import { encryptTotpSecret } from '../src/utils/conflictTotpEncryption'
import { encryptConflictReport } from '../src/utils/conflictEncryption'
import { calculateConflictHash } from '../src/utils/conflictDocumentHash'

const originalKey = process.env.CONFLICT_ENCRYPTION_KEY
process.env.CONFLICT_ENCRYPTION_KEY = randomBytes(32).toString('hex')

const secret = authenticator.generateSecret()
const validCode = () => authenticator.generate(secret)

const createFixture = () => {
  const state = {
    credential: {
      userId: 'usuario-1',
      encryptedSecret: encryptTotpSecret(secret),
      verifiedAt: new Date(),
      lastUsedStep: null as bigint | null,
      failedAttempts: 0,
      lockedUntil: null as Date | null,
    },
    conflict: {
      id: 'conflicto-1',
      documentUuid: 'documento-1',
      studentId: 'alumno-1',
      authorId: 'usuario-1',
      conflictCode: 'CONFLICTO',
      detailedReport: encryptConflictReport('Informe original'),
      occurrenceDate: null,
      registeredAt: new Date('2026-11-08T12:00:00Z'),
      editLocked: true,
      digitalSignHash: null as string | null,
      electronicSignature: null as object | null,
      attachments: [
        {
          id: 'anexo-1',
          authorId: 'autor-1',
          content: 'Anexo original',
          date: new Date('2026-11-08T12:10:00Z'),
          digitalSignHash: 'hash-anexo',
        },
      ],
    },
    signatures: [] as object[],
    audits: [] as object[],
  }

  const tx = {
    $queryRaw: async () => [],
    conflictTotpCredential: {
      findUnique: async () => ({ ...state.credential }),
      update: async ({ data }: any) => {
        Object.assign(state.credential, data)
        return state.credential
      },
    },
    legalConflict: {
      findUnique: async () => ({
        ...state.conflict,
        attachments: [...state.conflict.attachments],
      }),
      update: async ({ data }: any) => {
        Object.assign(state.conflict, data)
        return state.conflict
      },
    },
    conflictElectronicSignature: {
      create: async ({ data }: any) => {
        const signature = {
          id: 'firma-1',
          ...data,
          signedAt: new Date('2026-11-08T12:20:00Z'),
        }
        state.signatures.push(signature)
        state.conflict.electronicSignature = signature
        return signature
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.audits.push(data)
        return data
      },
    },
  }

  const db = {
    $transaction: async (callback: any) => callback(tx),
  }

  const sign = createSignLegalConflict(db as any)

  const request = (totpCode = validCode()) => ({
    conflictId: 'conflicto-1',
    signerId: 'usuario-1',
    totpCode,
    accepted: true,
    ipAddress: '127.0.0.1',
  })

  return { state, sign, request }
}

test('firma un acta bloqueada sin modificar el original y registra auditoría', async () => {
  const { state, sign, request } = createFixture()

  const result = await sign(request())

  assert.equal(result.editLocked, true)
  assert.equal(state.conflict.editLocked, true)
  assert.equal(state.signatures.length, 1)
  assert.equal(state.audits.length, 1)
  assert.equal(state.conflict.digitalSignHash, null)
  assert.equal((state.signatures[0] as { documentHash: string }).documentHash, result.documentHash)

  const expectedHash = calculateConflictHash({
    documentUuid: state.conflict.documentUuid,
    studentId: state.conflict.studentId,
    authorId: state.conflict.authorId,
    conflictCode: state.conflict.conflictCode,
    detailedReport: 'Informe original',
    occurrenceDate: state.conflict.occurrenceDate,
    registeredAt: state.conflict.registeredAt,
    attachments: [],
  })

  assert.equal(result.documentHash, expectedHash)
})

test('rechaza firmar un acta creada por otro usuario', async () => {
  const { state, sign, request } = createFixture()

  state.conflict.authorId = 'otro-autor'

  await assert.rejects(sign(request()), (error: unknown) => {
    assert.equal((error as { status?: number }).status, 403)
    assert.match((error as Error).message, /Solo el autor del acta puede firmarla/)
    return true
  })

  assert.equal(state.signatures.length, 0)
  assert.equal(state.audits.length, 0)
})

test('rechaza firmar nuevamente un acta ya firmada', async () => {
  const { state, sign, request } = createFixture()

  state.conflict.electronicSignature = { id: 'firma-existente' }

  await assert.rejects(sign(request()), /El acta ya está firmada/)

  assert.equal(state.signatures.length, 0)
})

test('rechaza reutilizar un código TOTP', async () => {
  const { state, sign, request } = createFixture()

  state.credential.lastUsedStep = BigInt(Math.floor(Date.now() / 30_000) + 1)

  await assert.rejects(sign(request()), /Este código TOTP ya fue utilizado/)

  assert.equal(state.signatures.length, 0)
})

test('bloquea el autenticador tras cinco códigos incorrectos', async () => {
  const { state, sign, request } = createFixture()

  const code = validCode()
  const invalidCode = String((Number(code) + 500000) % 1000000).padStart(6, '0')

  for (let attempt = 1; attempt <= 5; attempt++) {
    await assert.rejects(
      sign(request(invalidCode)),
      attempt === 5 ? /Demasiados intentos/ : /Código TOTP incorrecto/
    )
  }

  assert.ok(state.credential.lockedUntil instanceof Date)
  assert.equal(state.credential.failedAttempts, 0)

  await assert.rejects(sign(request()), /Autenticador bloqueado temporalmente/)
})

test('rechaza la firma sin aceptación expresa', async () => {
  const { state, sign, request } = createFixture()

  await assert.rejects(sign({ ...request(), accepted: false }), /aceptar expresamente/)

  assert.equal(state.signatures.length, 0)
})

process.on('exit', () => {
  if (originalKey === undefined) {
    delete process.env.CONFLICT_ENCRYPTION_KEY
  } else {
    process.env.CONFLICT_ENCRYPTION_KEY = originalKey
  }
})
