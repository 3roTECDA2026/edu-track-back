import { z } from 'zod'
import { Shift, StudentStatus } from '@prisma/client'

// Los ids se validan con z.guid() (formato 8-4-4-4-12) y no con z.uuid(), que en Zod 4
// exige un UUID con versión válida y rechaza los ids fijos del seed (00000000-...).
export const studentIdParamSchema = z.object({
  id: z.guid(),
})

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  // Omitted -> operational listing (ACTIVE + CONDITIONAL). "all" -> every status.
  status: z.union([z.enum(StudentStatus), z.literal('all')]).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  grade: z.coerce.number().int().min(1).max(7).optional(),
  division: z.string().trim().min(1).max(10).optional(),
  shift: z.enum(Shift).optional(),
})

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos'),
  dateOfBirth: z.coerce.date(),
  placeOfBirth: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\d{6,15}$/, 'Teléfono inválido'),
  classSectionId: z.guid(),
  guardianName: z.string().trim().min(1).max(150),
  guardianPhone: z
    .string()
    .trim()
    .regex(/^\d{6,15}$/, 'Teléfono inválido'),
  guardianEmail: z.email(),
  guardianDni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos')
    .optional(),
  guardianRelationship: z.string().trim().min(1).max(50).optional(),
})

// Datos editables, con las mismas reglas que el alta: datos personales, domicilio
// y adulto responsable. El legajo, el estado y la inscripción no se modifican por acá.
export const updateStudentSchema = createStudentSchema
  .pick({
    firstName: true,
    lastName: true,
    dni: true,
    dateOfBirth: true,
    placeOfBirth: true,
    address: true,
    city: true,
    phone: true,
    guardianName: true,
    guardianPhone: true,
    guardianEmail: true,
    guardianDni: true,
    guardianRelationship: true,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Hay que enviar al menos un campo para actualizar',
  })

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>