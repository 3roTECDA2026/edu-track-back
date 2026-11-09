import { encryptConflictReport, decryptConflictReport } from './conflictEncryption'

// Ambos utilizan AES-256-GCM y el mismo formato versionado.
// Se conserva la interfaz pública para no afectar los servicios.

export const encryptTotpSecret = (secret: string): string => {
  return encryptConflictReport(secret)
}

export const decryptTotpSecret = (value: string): string => {
  if (!/^v1:[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:(?:[0-9a-fA-F]{2})+$/.test(value)) {
    throw new Error('Datos de cifrado TOTP inválidos')
  }

  return decryptConflictReport(value)
}
