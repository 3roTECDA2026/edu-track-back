import { Role, UserStatus } from '@prisma/client'
import { z } from 'zod'

export const userIdParamSchema = z.object({
  id: z.uuid(),
})

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  role: z.enum(Role).optional(),
  // ?active=true -> ACTIVE | ?active=false -> SUSPENDED o INACTIVE
  active: z.stringbool().optional(),
  // Filtro exacto; si viene, tiene prioridad sobre "active"
  status: z.enum(UserStatus).optional(),
})

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100),
  role: z.enum(Role),
})

// strictObject: si mandan "password" (o cualquier campo desconocido) responde 400
export const updateUserSchema = z
  .strictObject({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.email('Email inválido'),
    role: z.enum(Role),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Hay que enviar al menos un campo para actualizar',
  })

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
