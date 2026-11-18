import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PDFDocument, StandardFonts } from 'pdf-lib'

import {
  buildEdteMinutesPdf,
  formatDateTime,
  sanitizeText,
  wrapText,
  type MinutesData,
} from './edteMinutesPdf'

const signedAt = new Date('2026-03-12T17:30:00.000Z') // 14:30 en Argentina

const meeting = (overrides: Partial<MinutesData> = {}): MinutesData => ({
  institution: 'ISFDyT Nº 166 · Distrito Tandil',
  year: 2026,
  date: '2026-03-12',
  period: 'FEBRUARY_MARCH',
  shift: 'MORNING',
  signed: true,
  signedAt,
  considerations: 'Se acordó acompañar a los alumnos con más de dos materias pendientes.',
  members: [
    {
      name: 'Pérez, Ana',
      role: 'SCHOOL_MANAGEMENT',
      present: true,
      signedAt,
      signatureHash: 'a'.repeat(64),
    },
    { name: 'Gómez, Luis', role: 'TEACHER', present: false, signedAt: null, signatureHash: null },
  ],
  students: [{ name: 'Núñez, Sofía', dni: '45123456', section: '3° A', notes: 'Recursa Física.' }],
  generatedAt: new Date('2026-03-13T12:00:00.000Z'),
  ...overrides,
})

const loadFont = async () => (await PDFDocument.create()).embedFont(StandardFonts.Helvetica)

describe('acta de la reunión del EDTE en PDF (CRM-076)', () => {
  it('genera un PDF de una hoja con el título de la reunión', async () => {
    const bytes = await buildEdteMinutesPdf(meeting())
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-')
    const doc = await PDFDocument.load(bytes)
    assert.equal(doc.getPageCount(), 1)
    assert.equal(doc.getTitle(), 'Acta de reunión del EDTE (12/03/2026)')
  })

  it('no falla con caracteres que la fuente no tiene y sigue en otra hoja si el texto es largo', async () => {
    const bytes = await buildEdteMinutesPdf(
      meeting({
        signed: false,
        signedAt: null,
        considerations: `Acuerdo 👍 → seguimiento\t${'texto largo '.repeat(800)}`,
      })
    )
    const doc = await PDFDocument.load(bytes)
    assert.ok(doc.getPageCount() > 1)
  })

  it('arma el acta aunque no haya integrantes, alumnos ni consideraciones', async () => {
    const bytes = await buildEdteMinutesPdf(
      meeting({ shift: null, members: [], students: [], considerations: null })
    )
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
  })
})

describe('textos del acta', () => {
  it('reemplaza por "?" los caracteres que la fuente no puede escribir', async () => {
    const font = await loadFont()
    assert.equal(sanitizeText('Año 3° → listo 👍', font), 'Año 3° ? listo ?')
  })

  it('corta en renglones que entran en el ancho y respeta los saltos de línea', async () => {
    const font = await loadFont()
    const lines = wrapText(`${'palabra '.repeat(30)}\nsegundo párrafo`, font, 10, 200)
    assert.ok(lines.length > 2)
    assert.ok(lines.every((line) => font.widthOfTextAtSize(line, 10) <= 200))
    assert.equal(lines[lines.length - 1], 'segundo párrafo')
  })

  it('corta por letras una palabra más larga que el renglón', async () => {
    const font = await loadFont()
    const lines = wrapText('x'.repeat(200), font, 10, 100)
    assert.ok(lines.length > 1)
    assert.ok(lines.every((line) => font.widthOfTextAtSize(line, 10) <= 100))
    assert.equal(lines.join(''), 'x'.repeat(200))
  })

  it('muestra la fecha y la hora en la zona horaria de la escuela', () => {
    assert.equal(formatDateTime(signedAt), '12/03/2026 14:30')
  })
})
