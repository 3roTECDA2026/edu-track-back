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
