import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encryptConflictReport, decryptConflictReport } from '../src/utils/conflictEncryption'
import { encryptTotpSecret, decryptTotpSecret } from '../src/utils/conflictTotpEncryption'

const withTestKey = (callback: () => void) => {
  const previous = process.env.CONFLICT_ENCRYPTION_KEY
  process.env.CONFLICT_ENCRYPTION_KEY = 'ab'.repeat(32)

  try {
    callback()
  } finally {
    if (previous === undefined) {
      delete process.env.CONFLICT_ENCRYPTION_KEY
    } else {
      process.env.CONFLICT_ENCRYPTION_KEY = previous
    }
  }
}

test('CRM-090: TOTP descifra datos cifrados por el módulo de informes', () => {
  withTestKey(() => {
    const secret = 'SECRETO-TOTP-PRUEBA'
    const encrypted = encryptConflictReport(secret)

    assert.equal(decryptTotpSecret(encrypted), secret)
  })
})

test('CRM-090: informes descifran datos cifrados por el módulo TOTP', () => {
  withTestKey(() => {
    const report = 'Informe de prueba'
    const encrypted = encryptTotpSecret(report)

    assert.equal(decryptConflictReport(encrypted), report)
  })
})

test('CRM-090: detecta alteraciones en el texto cifrado', () => {
  withTestKey(() => {
    const encrypted = encryptTotpSecret('SECRETO-PRUEBA')
    const parts = encrypted.split(':')
    const ciphertext = parts[3]!

    parts[3] = (ciphertext[0] === 'a' ? 'b' : 'a') + ciphertext.slice(1)

    assert.throws(() => decryptTotpSecret(parts.join(':')))
  })
})
