import { authenticator } from 'otplib'

// Configuración de códigos temporales de seis dígitos
authenticator.options = {
  step: 30,
  digits: 6,
  window: 1,
}

// Genera el secreto para vincular una aplicación autenticadora
export const generateTotpSecret = (): string => {
  return authenticator.generateSecret()
}

// Genera el enlace de configuración del autenticador
export const generateTotpUri = (email: string, secret: string): string => {
  return authenticator.keyuri(email, 'Notar', secret)
}

// Verifica que el código corresponda al secreto
export const verifyTotpCode = (code: string, secret: string): boolean => {
  if (!/^\d{6}$/.test(code)) {
    return false
  }

  return authenticator.check(code, secret)
}

export { authenticator }
