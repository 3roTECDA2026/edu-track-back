import { EdteMeetingPeriod, EdteMeetingStatus, Shift } from '@prisma/client'
import { z } from 'zod'

// Reuniones del EDTE (E4-RF-03, CRM-075)

// Fecha en formato AAAA-MM-DD
const dateSchema = z.string().date()
const yearSchema = z.number().int().min(2000).max(2100)
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

export const edteMeetingIdParamSchema = z.object({
  id: z.guid(),
})

export const listEdteMeetingsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  period: z.enum(EdteMeetingPeriod).optional(),
  status: z.enum(EdteMeetingStatus).optional(),
})

// Alumnos para tratar en una reunión: dependen del ciclo y del período
export const edteMeetingCandidatesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  period: z.enum(EdteMeetingPeriod),
})

// Integrante convocado: presente o ausente (el acta lista a los convocados)
const memberSchema = z.object({
  userId: z.guid(),
  present: z.boolean(),
})

// Alumno tratado, con consideraciones propias opcionales
const studentSchema = z.object({
  studentId: z.guid(),
  notes: optionalText(2000),
})

const hasNoRepeated = (values: string[]) => new Set(values).size === values.length

const membersSchema = z
  .array(memberSchema)
  .max(100)
  .refine((members) => hasNoRepeated(members.map((member) => member.userId)), {
    message: 'Hay integrantes repetidos',
  })

const studentsSchema = z
  .array(studentSchema)
  .max(200)
  .refine((students) => hasNoRepeated(students.map((student) => student.studentId)), {
    message: 'Hay alumnos repetidos',
  })

const meetingFields = {
  date: dateSchema,
  period: z.enum(EdteMeetingPeriod),
  shift: z.enum(Shift).nullable().optional(),
  considerations: optionalText(5000),
  // Solo http y https: el enlace se abre desde el detalle, y otros protocolos (como javascript: o
  // data:) permitirían ejecutar código en el navegador de quien haga clic
  minutesUrl: z
    .url({
      protocol: /^https?$/,
      error: 'El enlace al acta tiene que ser una dirección web que empiece con http:// o https://',
    })
    .max(500)
    .nullable()
    .optional(),
  members: membersSchema,
  students: studentsSchema,
}

// Alta: el ciclo lectivo es el de las decisiones de la reunión (la de febrero/marzo de 2026
// arma los PATE de 2026, aunque analice el cierre de 2025)
export const createEdteMeetingSchema = z.object({
  year: yearSchema,
  ...meetingFields,
  members: membersSchema.default([]),
  students: studentsSchema.default([]),
})

// Edición (solo en borrador): las listas que vienen reemplazan a las anteriores
export const updateEdteMeetingSchema = z
  .object({
    date: meetingFields.date.optional(),
    period: meetingFields.period.optional(),
    shift: meetingFields.shift,
    considerations: meetingFields.considerations,
    minutesUrl: meetingFields.minutesUrl,
    members: membersSchema.optional(),
    students: studentsSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay cambios para guardar',
  })

export type ListEdteMeetingsQuery = z.infer<typeof listEdteMeetingsQuerySchema>
export type EdteMeetingCandidatesQuery = z.infer<typeof edteMeetingCandidatesQuerySchema>
export type CreateEdteMeetingInput = z.infer<typeof createEdteMeetingSchema>
export type UpdateEdteMeetingInput = z.infer<typeof updateEdteMeetingSchema>
