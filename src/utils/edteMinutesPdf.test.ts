import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildEdteMinutesPdf,
  formatDateTime,
  fromMinutesSnapshot,
  minutesContentHash,
  sanitizeText,
  toMinutesSnapshot,
  type MinutesContent,
} from './edteMinutesPdf'

const signedAt = new Date('2026-03-12T17:30:00.000Z') // 14:30 en Argentina
const generatedAt = new Date('2026-03-13T12:00:00.000Z')

const meeting = (overrides: Partial<MinutesContent> = {}): MinutesContent => ({
  institution: 'Escuela Normal · Nº 166 · Distrito Tandil',
  year: 2026,
  date: '2026-03-12',
  period: 'FEBRUARY_MARCH',
  shift: 'MORNING',
  considerations: 'Se acordó acompañar a los alumnos con más de dos materias pendientes.',
  signed: true,
  signedAt,
  members: [
    {
      userId: 'u1',
      name: 'Pérez, Ana',
      role: 'SCHOOL_MANAGEMENT',
      present: true,
      signedAt,
      signatureHash: 'a'.repeat(64),
    },
    {
      userId: 'u2',
      name: 'Gómez, Luis',
      role: 'TEACHER',
      present: false,
      signedAt: null,
      signatureHash: null,
    },
  ],
  students: [
    {
      studentId: 's1',
      name: 'Núñez, Sofía',
      dni: '45123456',
      section: '3° A',
      notes: 'Recursa Física.',
    },
  ],
  ...overrides,
})

// Cantidad de hojas del PDF (cada hoja es un objeto "/Type /Page")
const pageCount = (pdf: Buffer) =>
  (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length

describe('acta de la reunión del EDTE en PDF (CRM-076)', () => {
  it('genera un PDF de una hoja', async () => {
    const pdf = await buildEdteMinutesPdf(meeting(), generatedAt)
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    assert.equal(pageCount(pdf), 1)
  })

  it('no falla con caracteres que la fuente no tiene y sigue en otra hoja si el texto es largo', async () => {
    const pdf = await buildEdteMinutesPdf(
      meeting({
        signed: false,
        signedAt: null,
        considerations: `Acuerdo 👍 → seguimiento\t${'texto largo '.repeat(800)}`,
      }),
      generatedAt
    )
    assert.ok(pageCount(pdf) > 1)
  })

  it('arma el acta aunque no haya integrantes, alumnos ni consideraciones', async () => {
    const pdf = await buildEdteMinutesPdf(
      meeting({ shift: null, members: [], students: [], considerations: null }),
      generatedAt
    )
    assert.equal(pageCount(pdf), 1)
  })
})

describe('huella del contenido del acta', () => {
  it('es la misma para el mismo contenido', () => {
    assert.equal(minutesContentHash(meeting()), minutesContentHash(meeting()))
  })

  it('cambia si cambia el acta (un alumno o una consideración)', () => {
    const base = minutesContentHash(meeting())
    assert.notEqual(minutesContentHash(meeting({ considerations: 'Otro acuerdo' })), base)
    assert.notEqual(minutesContentHash(meeting({ students: [] })), base)
  })

  it('no cambia con las firmas: es lo que firma cada integrante', () => {
    const unsigned = meeting({
      signed: false,
      signedAt: null,
      members: meeting().members.map((member) => ({
        ...member,
        signedAt: null,
        signatureHash: null,
      })),
    })
    assert.equal(minutesContentHash(unsigned), minutesContentHash(meeting()))
  })
})

describe('copia fija del acta', () => {
  it('se guarda como JSON y se recupera igual, con las fechas', () => {
    const json = JSON.parse(JSON.stringify(toMinutesSnapshot(meeting())))
    assert.deepEqual(fromMinutesSnapshot(json), meeting())
  })
})

describe('textos del acta', () => {
  it('reemplaza por "?" los caracteres que la fuente no puede escribir', () => {
    assert.equal(sanitizeText('Año 3° — “listo” → 👍\tfin'), 'Año 3° — “listo” ? ? fin')
  })

  it('muestra la fecha y la hora en la zona horaria de la escuela', () => {
    assert.equal(formatDateTime(signedAt), '12/03/2026 14:30')
  })
})
