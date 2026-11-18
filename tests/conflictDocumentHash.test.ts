import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateConflictHash } from '../src/utils/conflictDocumentHash'

const document = {
  documentUuid: 'documento-001',
  studentId: 'alumno-001',
  authorId: 'profesional-001',
  conflictCode: 'CONFLICTO',
  detailedReport: 'Informe original',
  occurrenceDate: null,
  registeredAt: new Date('2026-11-08T12:00:00Z'),
  attachments: [
    {
      id: 'anexo-001',
      authorId: 'profesional-001',
      content: 'Contenido del anexo',
      date: new Date('2026-11-08T12:10:00Z'),
      digitalSignHash: 'hash-anexo',
    },
  ],
}

test('genera un hash SHA-256 de 64 caracteres', () => {
  const hash = calculateConflictHash(document)
  assert.match(hash, /^[a-f0-9]{64}$/)
})

test('el mismo documento produce el mismo hash', () => {
  assert.equal(calculateConflictHash(document), calculateConflictHash(document))
})

test('modificar el informe cambia el hash', () => {
  const modified = {
    ...document,
    detailedReport: 'Informe modificado',
  }

  assert.notEqual(calculateConflictHash(document), calculateConflictHash(modified))
})

test('modificar un anexo cambia el hash', () => {
  const modified = {
    ...document,
    attachments: [
      {
        ...document.attachments[0]!,
        content: 'Anexo modificado',
      },
    ],
  }

  assert.notEqual(calculateConflictHash(document), calculateConflictHash(modified))
})

test('el orden de los anexos no cambia el hash', () => {
  const secondAttachment = {
    ...document.attachments[0]!,
    id: 'anexo-002',
  }

  const first = {
    ...document,
    attachments: [...document.attachments, secondAttachment],
  }

  const reversed = {
    ...first,
    attachments: [...first.attachments].reverse(),
  }

  assert.equal(calculateConflictHash(first), calculateConflictHash(reversed))
})

// ============================================================================
// CRM-093: hash de integridad de actas y anexos
// ============================================================================

import { randomBytes } from 'node:crypto'

import {
  calculateAttachmentHash,
  calculateConflictRecordHash,
  hashesMatch,
} from '../src/utils/conflictDocumentHash'

const withHashKey = <T>(key: string | undefined, run: () => T): T => {
  const previous = process.env.CONFLICT_HASH_KEY
  if (key === undefined) delete process.env.CONFLICT_HASH_KEY
  else process.env.CONFLICT_HASH_KEY = key
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.CONFLICT_HASH_KEY
    else process.env.CONFLICT_HASH_KEY = previous
  }
}

const HASH_KEY = 'cd'.repeat(32)

const { attachments: _attachments, ...record } = document

const attachment = {
  documentUuid: 'anexo-uuid-001',
  conflictId: 'conflicto-001',
  authorId: 'profesional-001',
  content: 'Contenido del anexo',
  date: new Date('2026-11-08T12:10:00Z'),
}

test('CRM-093: el hash de la firma TOTP no cambia (firmas ya guardadas)', () => {
  assert.equal(
    calculateConflictHash({ ...document, attachments: [] }),
    'd18d9bdb0fdd2aaa8c24da649be9df45d3ecf554f186ccec447de56cb126aa79'
  )
})

test('CRM-093: el hash del acta es un HMAC de 64 caracteres y es estable', () => {
  withHashKey(HASH_KEY, () => {
    const hash = calculateConflictRecordHash(record)
    assert.match(hash, /^[a-f0-9]{64}$/)
    assert.equal(hash, calculateConflictRecordHash(record))
  })
})

test('CRM-093: cambiar contenido, autor, fecha, uuid, alumno o código cambia el hash del acta', () => {
  withHashKey(HASH_KEY, () => {
    const original = calculateConflictRecordHash(record)
    const changes = [
      { detailedReport: 'Informe modificado' },
      { authorId: 'otro-autor' },
      { registeredAt: new Date('2026-11-08T12:00:00.001Z') },
      { documentUuid: 'documento-002' },
      { studentId: 'alumno-002' },
      { conflictCode: 'OTRO' },
      { occurrenceDate: new Date('2026-11-01T00:00:00Z') },
    ]
    for (const change of changes) {
      assert.notEqual(calculateConflictRecordHash({ ...record, ...change }), original)
    }
  })
})

test('CRM-093: el hash depende de la clave (sin la clave no se puede recalcular)', () => {
  const withKey = withHashKey(HASH_KEY, () => calculateConflictRecordHash(record))
  const withOtherKey = withHashKey('ef'.repeat(32), () => calculateConflictRecordHash(record))
  assert.notEqual(withKey, withOtherKey)
  // Tampoco coincide con el SHA-256 sin clave de la firma TOTP
  assert.notEqual(withKey, calculateConflictHash({ ...document, attachments: [] }))
})

test('CRM-093: sin CONFLICT_HASH_KEY válida, el hash falla', () => {
  withHashKey(undefined, () => {
    assert.throws(() => calculateConflictRecordHash(record), /CONFLICT_HASH_KEY/)
  })
  withHashKey('corta', () => {
    assert.throws(() => calculateAttachmentHash(attachment), /CONFLICT_HASH_KEY/)
  })
})

test('CRM-093: cambiar cualquier dato del anexo, o moverlo a otra acta, cambia su hash', () => {
  withHashKey(HASH_KEY, () => {
    const original = calculateAttachmentHash(attachment)
    assert.match(original, /^[a-f0-9]{64}$/)
    const changes = [
      { content: 'Anexo modificado' },
      { conflictId: 'conflicto-002' },
      { authorId: 'otro-autor' },
      { date: new Date('2026-11-08T12:10:01Z') },
      { documentUuid: 'anexo-uuid-002' },
    ]
    for (const change of changes) {
      assert.notEqual(calculateAttachmentHash({ ...attachment, ...change }), original)
    }
  })
})

test('CRM-093: hashesMatch compara exacto, también con largos distintos', () => {
  const hash = randomBytes(32).toString('hex')
  assert.equal(hashesMatch(hash, hash), true)
  assert.equal(
    hashesMatch(
      hash,
      hash.replace(/.$/, (c) => (c === '0' ? '1' : '0'))
    ),
    false
  )
  assert.equal(hashesMatch(hash, hash.slice(0, 10)), false)
})
