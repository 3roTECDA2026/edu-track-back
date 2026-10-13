
import { z } from 'zod'

// Validación del inicio de sesión
export const loginSchema = z.object({
  email: z.email('El correo electrónico no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>

// Solicitar recuperación de contraseña
export const forgotPasswordSchema = z.object({
  email: z.email('Ingresá un correo electrónico válido').trim().toLowerCase(),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// Restablecer contraseña con token
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'El token es obligatorio'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña es demasiado larga'),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
