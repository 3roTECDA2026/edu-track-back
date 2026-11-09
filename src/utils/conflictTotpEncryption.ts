import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const getEncryptionKey = (): Buffer => {
  const value = process.env.CONFLICT_ENCRYPTION_KEY

  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      'CONFLICT_ENCRYPTION_KEY debe contener 64 caracteres hexadecimales'
    )
  }

  return Buffer.from(value, 'hex')
}

export const encryptTotpSecret = (secret: string): string => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)

  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

export const decryptTotpSecret = (value: string): string => {
  const parts = value.split(':')

  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Formato de secreto TOTP cifrado inválido')
  }

  const ivHex = parts[1]
  const tagHex = parts[2]
  const encryptedHex = parts[3]

  // Comprobar que las partes existen antes de utilizarlas
  if (
    ivHex === undefined ||
    tagHex === undefined ||
    encryptedHex === undefined ||
    !/^[0-9a-fA-F]{24}$/.test(ivHex) ||
    !/^[0-9a-fA-F]{32}$/.test(tagHex) ||
    !/^(?:[0-9a-fA-F]{2})+$/.test(encryptedHex)
  ) {
    throw new Error('Datos de cifrado TOTP inválidos')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  )

  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
