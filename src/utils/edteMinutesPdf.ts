import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from 'pdf-lib'

import { SCHOOL_TIME_ZONE } from './schoolDate'

// Acta de una reunión del EDTE en PDF (E4-RF-04, CRM-076). Recibe los datos ya armados, sin
// Prisma, para poder probarla sola. Se genera al descargarla: una vez firmada, sale siempre igual.

export interface MinutesMember {
  name: string
  role: string | null
  present: boolean
  signedAt: Date | null
  signatureHash: string | null
}

export interface MinutesStudent {
  name: string
  dni: string
  section: string | null
  notes: string | null
}

export interface MinutesData {
  institution: string
  year: number
  date: string // AAAA-MM-DD
  period: string
  shift: string | null
  signed: boolean
  signedAt: Date | null
  considerations: string | null
  members: MinutesMember[]
  students: MinutesStudent[]
  generatedAt: Date
}

const PERIOD_LABELS: Record<string, string> = {
  FEBRUARY_MARCH: 'Febrero/marzo',
  AUGUST: 'Agosto',
  DECEMBER: 'Diciembre',
  ADDITIONAL: 'Adicional',
}

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

// Hoja A4, en puntos
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const TEXT_SIZE = 10
const INK = rgb(0.07, 0.09, 0.15) // #111827, el negro del sistema
const MUTED = rgb(0.42, 0.45, 0.5)
const DANGER = rgb(0.86, 0.15, 0.15) // #dc2626, para marcar el borrador y las firmas pendientes

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

// Las fuentes estándar del PDF no tienen todos los caracteres (emojis, flechas): los que faltan
// se reemplazan por "?" para que el acta se genere igual
export function sanitizeText(text: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet())
  return Array.from(text.replace(/\r\n?/g, '\n').replace(/\t/g, ' '))
    .map((char) => (char === '\n' || supported.has(char.codePointAt(0) ?? 0) ? char : '?'))
    .join('')
}

// Corta el texto en renglones que entran en el ancho, respetando los saltos de línea
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= maxWidth
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (fits(candidate)) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      // Una palabra más larga que el renglón (un enlace, por ejemplo) se corta por letras
      line = ''
      for (const char of word) {
        if (line && !fits(line + char)) {
          lines.push(line)
          line = ''
        }
        line += char
      }
    }
    lines.push(line)
  }
  return lines
}

// Estado de cada convocado: ausente, firma pendiente o cuándo firmó (con el inicio de su huella)
function memberSignature(member: MinutesMember) {
  if (!member.present) return 'Ausente'
  if (!member.signedAt) return 'Presente · firma pendiente'
  const hash = member.signatureHash ? ` · huella ${member.signatureHash.slice(0, 16)}` : ''
  return `Presente · firmó el ${formatDateTime(member.signedAt)}${hash}`
}

interface WriteOptions {
  font?: PDFFont
  size?: number
  color?: RGB
  indent?: number
}

export async function buildEdteMinutesPdf(data: MinutesData) {
  const doc = await PDFDocument.create()
  doc.setTitle(`Acta de reunión del EDTE (${formatDay(data.date)})`)
  doc.setCreator('EduTrack')
  doc.setCreationDate(data.generatedAt)
  doc.setModificationDate(data.generatedAt)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  // Si lo que sigue no entra (dejando lugar para el pie), pasa a una hoja nueva
  const ensureSpace = (height: number) => {
    if (y - height >= MARGIN + 20) return
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  const write = (text: string, options: WriteOptions = {}) => {
    const font = options.font ?? regular
    const size = options.size ?? TEXT_SIZE
    const indent = options.indent ?? 0
    const lineHeight = size * 1.4
    for (const line of wrapText(sanitizeText(text, font), font, size, CONTENT_WIDTH - indent)) {
      ensureSpace(lineHeight)
      y -= lineHeight
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: options.color ?? INK })
    }
  }

  const heading = (text: string) => {
    y -= 10
    ensureSpace(40) // que el título no quede solo al pie de la hoja
    write(text, { font: bold, size: 12 })
    y -= 4
  }

  if (!data.signed) {
    write('BORRADOR — sin validez hasta que firmen todos los integrantes presentes', {
      font: bold,
      color: DANGER,
    })
    y -= 8
  }
  write(data.institution, { font: bold, size: 11, color: MUTED })
  write('Acta de reunión del EDTE', { font: bold, size: 16 })
  write('Equipo de Definición de Trayectorias Educativas', { color: MUTED })
  y -= 8
  write(`Ciclo lectivo: ${data.year}`)
  write(`Fecha: ${formatDay(data.date)}`)
  write(`Período: ${PERIOD_LABELS[data.period] ?? data.period}`)
  write(`Turno: ${data.shift ? (SHIFT_LABELS[data.shift] ?? data.shift) : 'Sin turno'}`)
  if (data.signed && data.signedAt) write(`Acta firmada el ${formatDateTime(data.signedAt)}`)

  heading('Integrantes convocados')
  if (data.members.length === 0) write('No hay integrantes cargados.', { color: MUTED })
  for (const member of data.members) {
    const role = member.role ? ` (${ROLE_LABELS[member.role] ?? member.role})` : ''
    write(`${member.name}${role}`, { font: bold })
    const pending = member.present && !member.signedAt
    write(memberSignature(member), { indent: 12, color: pending ? DANGER : MUTED })
  }

  heading('Alumnos tratados')
  if (data.students.length === 0) write('No se trataron alumnos.', { color: MUTED })
  for (const student of data.students) {
    const section = student.section ? ` · ${student.section}` : ''
    write(`${student.name} · DNI ${student.dni}${section}`, { font: bold })
    if (student.notes) write(student.notes, { indent: 12 })
  }

  heading('Consideraciones pedagógicas y acuerdos')
  if (data.considerations) write(data.considerations)
  else write('Sin consideraciones registradas.', { color: MUTED })

  // Pie de cada hoja: cuándo se generó y número de hoja
  const pages = doc.getPages()
  const generated = `Generada por EduTrack el ${formatDateTime(data.generatedAt)}`
  pages.forEach((item, index) => {
    const pageLabel = `Página ${index + 1} de ${pages.length}`
    const footer = { y: MARGIN / 2, size: 8, font: regular, color: MUTED }
    item.drawText(generated, { ...footer, x: MARGIN })
    const labelWidth = regular.widthOfTextAtSize(pageLabel, 8)
    item.drawText(pageLabel, { ...footer, x: PAGE_WIDTH - MARGIN - labelWidth })
  })

  return doc.save()
}
