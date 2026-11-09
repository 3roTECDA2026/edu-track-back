import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

const getEncryptionKey = (): Buffer => {
  const key = process.env.CONFLICT_ENCRYPTION_KEY

  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('CONFLICT_ENCRYPTION_KEY debe contener 64 caracteres hexadecimales')
  }

  return Buffer.from(key, 'hex')
}

export const encryptConflictReport = (report: string): string => {
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)

  const encrypted = Buffer.concat([cipher.update(report, 'utf8'), cipher.final()])

  const authTag = cipher.getAuthTag()

  return ['v1', iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export const decryptConflictReport = (encryptedReport: string): string => {
  const parts = encryptedReport.split(':')

  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Formato de informe cifrado inválido')
  }

  const ivHex = parts[1]
  const authTagHex = parts[2]
  const encryptedHex = parts[3]

  if (ivHex === undefined || authTagHex === undefined || encryptedHex === undefined) {
    throw new Error('Datos de cifrado incompletos')
  }

  if (
    !/^[0-9a-fA-F]{24}$/.test(ivHex) ||
    !/^[0-9a-fA-F]{32}$/.test(authTagHex) ||
    !/^(?:[0-9a-fA-F]{2})*$/.test(encryptedHex)
  ) {
    throw new Error('Datos de cifrado inválidos')
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'))

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
