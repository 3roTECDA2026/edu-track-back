import { createHash } from 'node:crypto'

interface ConflictAttachment {
  id: string
  authorId: string
  content: string
  date: Date
  digitalSignHash: string
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

export const calculateConflictHash = (
  document: ConflictDocument
): string => {
  const content = JSON.stringify({
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

  return createHash('sha256')
    .update(content, 'utf8')
    .digest('hex')
}
