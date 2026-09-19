import { z } from 'zod';

// Esquema de validación
export const loginSchema = z.object({
  email: z.email('El correo electrónico no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

// Tipo derivado automáticamente para TypeScript
export type LoginInput = z.infer<typeof loginSchema>;