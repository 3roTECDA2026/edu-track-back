import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticator } from 'otplib'

import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode
} from '../src/utils/conflictTotp'

test('genera un secreto TOTP', () => {
  const secret = generateTotpSecret()

  assert.ok(secret.length > 0)
})

test('genera una URI para Notar', () => {
  const secret = generateTotpSecret()
  const uri = generateTotpUri('directivo@ejemplo.com', secret)

  assert.ok(uri.startsWith('otpauth://totp/'))
  assert.ok(uri.includes('Notar'))
})

test('acepta un código TOTP válido', () => {
  const secret = generateTotpSecret()
  const code = authenticator.generate(secret)

  assert.equal(verifyTotpCode(code, secret), true)
})

test('rechaza un código con formato incorrecto', () => {
  const secret = generateTotpSecret()

  assert.equal(verifyTotpCode('123', secret), false)
  assert.equal(verifyTotpCode('abcdef', secret), false)
})

test('rechaza un código generado con otro secreto', () => {
  const secret = generateTotpSecret()
  const otherSecret = generateTotpSecret()
  const code = authenticator.generate(secret)

  assert.equal(verifyTotpCode(code, otherSecret), false)
})
