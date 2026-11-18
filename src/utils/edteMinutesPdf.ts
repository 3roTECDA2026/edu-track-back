import { createHash } from 'node:crypto'

import PDFDocument from 'pdfkit'

import { SCHOOL_TIME_ZONE } from './schoolDate'

// Acta de una reunión del EDTE en PDF (E4-RF-04, CRM-076). Recibe los datos ya armados, sin
// Prisma, para poder probarla sola. Con la reunión firmada, los datos salen de la copia fija que
// se guarda al completarse las firmas: así el acta firmada no cambia aunque cambien los datos.

export interface MinutesMember {
  userId: string
  name: string
  role: string | null
  present: boolean
  signedAt: Date | null
  signatureHash: string | null
}

export interface MinutesStudent {
  studentId: string
  name: string
  dni: string
  section: string | null
  notes: string | null
}

export interface MinutesContent {
  institution: string
  year: number
  date: string // AAAA-MM-DD
  period: string
  shift: string | null
  considerations: string | null
  signed: boolean
  signedAt: Date | null
  members: MinutesMember[]
  students: MinutesStudent[]
}

// Huella del contenido del acta, sin las firmas: es lo que firma cada integrante. Si cambia algo
// del acta (un alumno, una consideración, la institución), cambia la huella.
export function minutesContentHash(content: MinutesContent) {
  const signable = {
    institution: content.institution,
    year: content.year,
    date: content.date,
    period: content.period,
    shift: content.shift,
    considerations: content.considerations,
    members: content.members.map((member) => ({
      userId: member.userId,
      name: member.name,
      role: member.role,
      present: member.present,
    })),
    students: content.students,
  }
  return createHash('sha256').update(JSON.stringify(signable)).digest('hex')
}

// Copia fija del acta, para guardarla como JSON: las fechas van como texto ISO
export function toMinutesSnapshot(content: MinutesContent) {
  return {
    ...content,
    signedAt: content.signedAt?.toISOString() ?? null,
    members: content.members.map((member) => ({
      ...member,
      signedAt: member.signedAt?.toISOString() ?? null,
    })),
  }
}

export type MinutesSnapshot = ReturnType<typeof toMinutesSnapshot>

export function fromMinutesSnapshot(snapshot: MinutesSnapshot): MinutesContent {
  return {
    ...snapshot,
    signedAt: snapshot.signedAt ? new Date(snapshot.signedAt) : null,
    members: snapshot.members.map((member) => ({
      ...member,
      signedAt: member.signedAt ? new Date(member.signedAt) : null,
    })),
  }
}

const PERIOD_LABELS: Record<string, string> = {
  FEBRUARY_MARCH: 'Febrero/marzo',
  AUGUST: 'Agosto',
  DECEMBER: 'Diciembre',
  ADDITIONAL: 'Adicional',
}

// Los mismos textos que el PDF del PATE
const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  EVENING: 'Vespertino',
  EXTRA_TIME: 'Contraturno',
}

const ROLE_LABELS: Record<string, string> = {
  SCHOOL_MANAGEMENT: 'Equipo de conducción',
  EOE_DIRECTIVE: 'EOE / directivo',
  TEACHER: 'Docente',
  PRECEPTOR: 'Preceptor/a',
  ADMINISTRATOR: 'Administración',
}

const MARGIN = 50
const TEXT_SIZE = 10
const INK = '#111827' // el negro del sistema
const MUTED = '#6b7280'
const DANGER = '#dc2626' // para marcar el borrador y las firmas pendientes

const formatDay = (day: string) => day.split('-').reverse().join('/')

// Fecha y hora en la zona horaria de la escuela, como DD/MM/AAAA HH:MM
export function formatDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: SCHOOL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`
}

// Las fuentes estándar del PDF solo tienen los caracteres de Windows-1252 (letras con tilde, ñ,
// comillas, rayas): los demás (emojis, flechas) se reemplazan por "?" para que salgan legibles
const UNSUPPORTED_CHARS =
  /[^\n\u0020-\u007e\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201a\u201c-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/gu

export function sanitizeText(text: string) {
  return text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(UNSUPPORTED_CHARS, '?')
}

// Estado de cada convocado: ausente, firma pendiente o cuándo firmó (con el inicio de su huella)
function memberSignature(member: MinutesMember) {
  if (!member.present) return 'Ausente'
  if (!member.signedAt) return 'Presente · firma pendiente'
  const hash = member.signatureHash ? ` · huella ${member.signatureHash.slice(0, 16)}` : ''
  return `Presente · firmó el ${formatDateTime(member.signedAt)}${hash}`
}

interface WriteOptions {
  bold?: boolean
  size?: number
  color?: string
  indent?: number
}

export function buildEdteMinutesPdf(content: MinutesContent, generatedAt: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true, // para numerar las hojas al final
      info: {
        Title: `Acta de reunión del EDTE (${formatDay(content.date)})`,
        Creator: 'EduTrack',
        CreationDate: generatedAt,
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const width = doc.page.width - MARGIN * 2

    // pdfkit corta los renglones y pasa de hoja solo
    const write = (text: string, options: WriteOptions = {}) => {
      const indent = options.indent ?? 0
      doc
        .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(options.size ?? TEXT_SIZE)
        .fillColor(options.color ?? INK)
        .text(sanitizeText(text), MARGIN + indent, undefined, { width: width - indent })
    }

    const heading = (text: string) => {
      doc.moveDown(0.8)
      // Que el título no quede solo al pie de la hoja
      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage()
      write(text, { bold: true, size: 12 })
      doc.moveDown(0.3)
    }

    if (!content.signed) {
      write('BORRADOR — sin validez hasta que firmen todos los integrantes presentes', {
        bold: true,
        color: DANGER,
      })
      doc.moveDown(0.5)
    }
    write(content.institution, { bold: true, size: 11, color: MUTED })
    write('Acta de reunión del EDTE', { bold: true, size: 16 })
    write('Equipo de Definición de Trayectorias Educativas', { color: MUTED })
    doc.moveDown(0.5)
    write(`Ciclo lectivo: ${content.year}`)
    write(`Fecha: ${formatDay(content.date)}`)
    write(`Período: ${PERIOD_LABELS[content.period] ?? content.period}`)
    write(`Turno: ${content.shift ? (SHIFT_LABELS[content.shift] ?? content.shift) : 'Sin turno'}`)
    if (content.signed && content.signedAt) {
      write(`Acta firmada el ${formatDateTime(content.signedAt)}`)
    }

    heading('Integrantes convocados')
    if (content.members.length === 0) write('No hay integrantes cargados.', { color: MUTED })
    for (const member of content.members) {
      const role = member.role ? ` (${ROLE_LABELS[member.role] ?? member.role})` : ''
      write(`${member.name}${role}`, { bold: true })
      const pending = member.present && !member.signedAt
      write(memberSignature(member), { indent: 12, color: pending ? DANGER : MUTED })
    }

    heading('Alumnos tratados')
    if (content.students.length === 0) write('No se trataron alumnos.', { color: MUTED })
    for (const student of content.students) {
      const section = student.section ? ` · ${student.section}` : ''
      write(`${student.name} · DNI ${student.dni}${section}`, { bold: true })
      if (student.notes) write(student.notes, { indent: 12 })
    }

    heading('Consideraciones pedagógicas y acuerdos')
    if (content.considerations) write(content.considerations)
    else write('Sin consideraciones registradas.', { color: MUTED })

    // Pie de cada hoja: cuándo se generó y número de hoja
    const generated = `Generada por EduTrack el ${formatDateTime(generatedAt)}`
    const range = doc.bufferedPageRange()
    for (let index = 0; index < range.count; index++) {
      doc.switchToPage(range.start + index)
      // Sin margen inferior, para escribir el pie sin que pdfkit agregue otra hoja
      const bottomMargin = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      const y = doc.page.height - 30
      const pageLabel = `Página ${index + 1} de ${range.count}`
      doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      doc.text(generated, MARGIN, y, { lineBreak: false })
      const labelX = doc.page.width - MARGIN - doc.widthOfString(pageLabel)
      doc.text(pageLabel, labelX, y, { lineBreak: false })
      doc.page.margins.bottom = bottomMargin
    }

    doc.end()
  })
}
