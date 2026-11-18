import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

interface ConflictAttachment {
  id: string
  authorId: string
  content: string
  date: Date
  digitalSignHash: string | null
}

interface ConflictDocument {
  documentUuid: string
  studentId: string
  authorId: string
  conflictCode: string
  detailedReport: string
  occurrenceDate: Date | null
  registeredAt: Date
  attachments: ConflictAttachment[]
}

// Contenido que se hashea del acta. La firma TOTP (CRM-090) y el hash de integridad (CRM-093)
// usan el mismo, así el hash del alta coincide con el documentHash de la firma.
const buildConflictPayload = (document: ConflictDocument): string =>
  JSON.stringify({
    documentUuid: document.documentUuid,
    studentId: document.studentId,
    authorId: document.authorId,
    conflictCode: document.conflictCode,
    detailedReport: document.detailedReport,
    occurrenceDate: document.occurrenceDate?.toISOString() ?? null,
    registeredAt: document.registeredAt.toISOString(),
    attachments: [...document.attachments]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((attachment) => ({
        id: attachment.id,
        authorId: attachment.authorId,
        content: attachment.content,
        date: attachment.date.toISOString(),
        digitalSignHash: attachment.digitalSignHash,
      })),
  })

// Hash de la firma TOTP (CRM-090). No cambiar su resultado: invalidaría las firmas guardadas.
export const calculateConflictHash = (document: ConflictDocument): string =>
  createHash('sha256').update(buildConflictPayload(document), 'utf8').digest('hex')

// ============================================================================
// Hash de integridad de actas y anexos (CRM-093, E4-RF-17)
// ============================================================================

// Datos del acta que entran en su hash (contenido en texto plano, no el cifrado).
export type ConflictRecord = Omit<ConflictDocument, 'attachments'>

// Datos del anexo que entran en su hash. conflictId evita que un anexo se "mueva" a otra acta.
export interface AttachmentRecord {
  documentUuid: string
  conflictId: string
  authorId: string
  content: string
  date: Date
}

// HMAC-SHA256 con una clave que no está en la base: quien pueda escribir en PostgreSQL no puede
// recalcular el hash de un acta alterada sin conocer CONFLICT_HASH_KEY.
const getHashKey = (): Buffer => {
  const key = process.env.CONFLICT_HASH_KEY

  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('CONFLICT_HASH_KEY debe contener 64 caracteres hexadecimales')
  }

  return Buffer.from(key, 'hex')
}

const hmacSha256 = (payload: string): string =>
  createHmac('sha256', getHashKey()).update(payload, 'utf8').digest('hex')

// Los anexos se agregan después del acta y tienen su propio hash: si entraran en el del acta,
// ese hash cambiaría con cada anexo.
export const calculateConflictRecordHash = (conflict: ConflictRecord): string =>
  hmacSha256(buildConflictPayload({ ...conflict, attachments: [] }))

export const calculateAttachmentHash = (attachment: AttachmentRecord): string =>
  hmacSha256(
    JSON.stringify({
      type: 'LegalConflictAttachment',
      documentUuid: attachment.documentUuid,
      conflictId: attachment.conflictId,
      authorId: attachment.authorId,
      content: attachment.content,
      date: attachment.date.toISOString(),
    })
  )

// Compara dos hashes en tiempo constante.
export const hashesMatch = (stored: string, calculated: string): boolean => {
  const a = Buffer.from(stored, 'utf8')
  const b = Buffer.from(calculated, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
