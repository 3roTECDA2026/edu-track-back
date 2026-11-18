import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  auditLogHash,
  evaluateIntegrity,
  evaluateSignature,
  overallIntegrity,
} from '../src/utils/conflictIntegrity'

const HASH = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

test('CRM-093: íntegro si el hash recalculado y el del log coinciden con el guardado', () => {
  assert.deepEqual(evaluateIntegrity({ storedHash: HASH, auditHash: HASH, calculatedHash: HASH }), {
    status: 'INTACT',
    reasons: [],
  })
})

test('CRM-093: alterado si el contenido cambió', () => {
  assert.deepEqual(
    evaluateIntegrity({ storedHash: HASH, auditHash: HASH, calculatedHash: OTHER }),
    {
      status: 'ALTERED',
      reasons: ['CONTENT_CHANGED'],
    }
  )
})

test('CRM-093: alterado si el contenido no se puede descifrar', () => {
  assert.deepEqual(evaluateIntegrity({ storedHash: HASH, auditHash: HASH, calculatedHash: null }), {
    status: 'ALTERED',
    reasons: ['UNREADABLE'],
  })
})

test('CRM-093: alterado si cambiaron el contenido y el hash guardado (el log no coincide)', () => {
  // Alguien cambió el informe y recalculó el hash guardado: el log inmutable lo delata
  assert.deepEqual(
    evaluateIntegrity({ storedHash: OTHER, auditHash: HASH, calculatedHash: OTHER }),
    {
      status: 'ALTERED',
      reasons: ['AUDIT_LOG_MISMATCH'],
    }
  )
})

test('CRM-093: un registro anterior a CRM-093 queda sin hash', () => {
  assert.deepEqual(evaluateIntegrity({ storedHash: null, auditHash: null, calculatedHash: HASH }), {
    status: 'NOT_HASHED',
    reasons: [],
  })
})

test('CRM-093: si el log tiene hash pero el registro no, alguien lo borró', () => {
  assert.deepEqual(evaluateIntegrity({ storedHash: null, auditHash: HASH, calculatedHash: HASH }), {
    status: 'ALTERED',
    reasons: ['AUDIT_LOG_MISMATCH'],
  })
})

test('CRM-093: sin log del alta, se verifica solo contra el hash guardado', () => {
  assert.equal(
    evaluateIntegrity({ storedHash: HASH, auditHash: null, calculatedHash: HASH }).status,
    'INTACT'
  )
})

test('CRM-093: estado de la firma TOTP', () => {
  assert.equal(evaluateSignature(null, HASH), 'UNSIGNED')
  assert.equal(evaluateSignature(HASH, HASH), 'MATCH')
  assert.equal(evaluateSignature(HASH, OTHER), 'MISMATCH')
  assert.equal(evaluateSignature(HASH, null), 'MISMATCH')
})

test('CRM-093: estado general del acta', () => {
  assert.equal(overallIntegrity(['INTACT', 'INTACT'], 'MATCH'), 'INTACT')
  assert.equal(overallIntegrity(['INTACT'], 'UNSIGNED'), 'INTACT')
  assert.equal(overallIntegrity(['INTACT', 'ALTERED'], 'MATCH'), 'ALTERED')
  assert.equal(overallIntegrity(['INTACT'], 'MISMATCH'), 'ALTERED')
  assert.equal(overallIntegrity(['NOT_HASHED', 'INTACT'], 'UNSIGNED'), 'NOT_HASHED')
  assert.equal(overallIntegrity(['NOT_HASHED', 'ALTERED'], 'UNSIGNED'), 'ALTERED')
})

test('CRM-093: lee el hash del newData del log', () => {
  assert.equal(auditLogHash({ conflictId: 'c', digitalSignHash: HASH }), HASH)
  assert.equal(auditLogHash({ conflictId: 'c' }), null)
  assert.equal(auditLogHash(null), null)
  assert.equal(auditLogHash([HASH]), null)
  assert.equal(auditLogHash({ digitalSignHash: 123 }), null)
})
