import { hashesMatch } from '@/utils/conflictDocumentHash'

// Verificación de integridad de actas y anexos (CRM-093, E4-RF-17). Funciones puras: el service
// busca los datos, descifra y calcula los hashes; acá solo se decide el resultado.

export type IntegrityStatus = 'INTACT' | 'ALTERED' | 'NOT_HASHED'
export type SignatureStatus = 'MATCH' | 'MISMATCH' | 'UNSIGNED'

// Por qué un documento quedó alterado
export type IntegrityReason =
  | 'CONTENT_CHANGED' // el hash recalculado no coincide con el guardado
  | 'UNREADABLE' // el contenido cifrado no se pudo descifrar (fue manipulado)
  | 'AUDIT_LOG_MISMATCH' // el hash guardado no coincide con la copia del AuditLog
  | 'AUDIT_LOG_MISSING' // tiene hash, pero falta la copia en el AuditLog del alta

export interface DocumentIntegrity {
  status: IntegrityStatus
  reasons: IntegrityReason[]
}

export interface IntegrityInput {
  storedHash: string | null // digitalSignHash del registro
  auditHash: string | null // copia del hash en el AuditLog del alta; null si no está
  calculatedHash: string | null // null si el contenido no se pudo descifrar
}

export function evaluateIntegrity({
  storedHash,
  auditHash,
  calculatedHash,
}: IntegrityInput): DocumentIntegrity {
  const reasons: IntegrityReason[] = []

  // Un contenido cifrado que no se puede descifrar fue manipulado, tenga hash o no.
  if (calculatedHash === null) reasons.push('UNREADABLE')

  // Registros anteriores a CRM-093: no tienen hash y no se les puede agregar (son inmutables).
  // Si el log sí tiene uno, alguien borró el hash del registro.
  if (storedHash === null) {
    if (auditHash !== null) reasons.push('AUDIT_LOG_MISMATCH')
    return reasons.length > 0
      ? { status: 'ALTERED', reasons }
      : { status: 'NOT_HASHED', reasons: [] }
  }

  if (calculatedHash !== null && !hashesMatch(storedHash, calculatedHash)) {
    reasons.push('CONTENT_CHANGED')
  }
  // Desde CRM-093, el alta guarda el hash en el registro y en el AuditLog en la misma
  // transacción: un registro con hash y sin su copia en el log no salió de un alta normal.
  if (auditHash === null) reasons.push('AUDIT_LOG_MISSING')
  else if (!hashesMatch(storedHash, auditHash)) reasons.push('AUDIT_LOG_MISMATCH')

  return { status: reasons.length > 0 ? 'ALTERED' : 'INTACT', reasons }
}

// Firma TOTP (CRM-090): compara el documentHash firmado con el que da el contenido actual.
export function evaluateSignature(
  signedHash: string | null, // null si el acta no está firmada
  calculatedHash: string | null // null si el contenido no se pudo descifrar
): SignatureStatus {
  if (signedHash === null) return 'UNSIGNED'
  if (calculatedHash === null) return 'MISMATCH'
  return hashesMatch(signedHash, calculatedHash) ? 'MATCH' : 'MISMATCH'
}

// Resultado del acta completa: alterada si lo está ella, algún anexo o la firma.
export function overallIntegrity(
  documents: IntegrityStatus[],
  signature: SignatureStatus
): IntegrityStatus {
  if (signature === 'MISMATCH' || documents.includes('ALTERED')) return 'ALTERED'
  if (documents.includes('NOT_HASHED')) return 'NOT_HASHED'
  return 'INTACT'
}

// Hash guardado en el AuditLog del alta (newData.digitalSignHash), o null si no hay.
export function auditLogHash(newData: unknown): string | null {
  if (newData === null || typeof newData !== 'object' || Array.isArray(newData)) return null
  const hash = (newData as Record<string, unknown>).digitalSignHash
  return typeof hash === 'string' ? hash : null
}
