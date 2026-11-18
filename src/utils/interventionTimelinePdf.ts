import type { InterventionEventType } from '@prisma/client'
import PDFDocument from 'pdfkit'

import { SCHOOL_TIME_ZONE } from '@/utils/schoolDate'

// PDF de la línea de tiempo de intervenciones de un alumno (CRM-088, E4-RF-13).
// Recibe los datos ya buscados y filtrados: acá solo se arma el documento.

export interface TimelinePdfIntervention {
  date: Date
  eventType: InterventionEventType
  classSection: { grade: number; division: string } | null
  author: { firstName: string; lastName: string }
  description: string
  interventionProposal: string | null
  involvedActors: string | null
  attachmentsCount: number
}

export interface TimelinePdfData {
  student: { firstName: string; lastName: string; dni: string }
  filters: { eventType?: InterventionEventType; from?: string; to?: string }
  generatedOn: string // AAAA-MM-DD
  interventions: TimelinePdfIntervention[] // ya ordenadas, la más reciente primero
}

export const EVENT_TYPE_LABELS: Record<InterventionEventType, string> = {
  PEDAGOGICAL: 'Pedagógico',
  CONDUCT: 'Conductual',
  HEALTH: 'Salud',
}

const INK = '#111827'
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'
// Espacio mínimo para empezar una intervención: si no entra el encabezado y un poco de texto,
// pasa a la página siguiente en vez de quedar cortada al pie.
const MIN_SPACE_FOR_ITEM = 90

const dayFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: SCHOOL_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

// Fecha guardada (Date) → "13/11/2026", en hora de Argentina
export function formatSchoolDay(date: Date): string {
  return dayFormatter.format(date)
}

// "2026-11-13" → "13/11/2026"
function formatIsoDay(day: string): string {
  const [year, month, dayOfMonth] = day.split('-')
  return `${dayOfMonth}/${month}/${year}`
}

export function describePeriod(from?: string, to?: string): string {
  if (from && to) return `Del ${formatIsoDay(from)} al ${formatIsoDay(to)}`
  if (from) return `Desde el ${formatIsoDay(from)}`
  if (to) return `Hasta el ${formatIsoDay(to)}`
  return 'Todas las fechas'
}

export function buildInterventionTimelinePdf(data: TimelinePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // bufferPages: guarda las páginas para numerarlas al final ("Página 1 de 3")
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
      info: { Title: `Intervenciones - ${data.student.lastName}, ${data.student.firstName}` },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const left = doc.page.margins.left
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

    const separator = () => {
      doc.moveDown(0.5)
      doc
        .moveTo(left, doc.y)
        .lineTo(left + contentWidth, doc.y)
        .lineWidth(0.5)
        .strokeColor(BORDER)
        .stroke()
      doc.moveDown(0.8)
    }

    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage()
    }

    // ---- Encabezado ----
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16)
    doc.text('Línea de tiempo de intervenciones', { align: 'center' })
    doc.moveDown()

    const { student, filters } = data
    doc.font('Helvetica').fontSize(11)
    doc.text(`Alumno/a: ${student.lastName}, ${student.firstName} (DNI ${student.dni})`)
    doc.text(
      `Tipo de evento: ${filters.eventType ? EVENT_TYPE_LABELS[filters.eventType] : 'Todos'}`
    )
    doc.text(`Período: ${describePeriod(filters.from, filters.to)}`)
    doc.text(`Generado el ${formatIsoDay(data.generatedOn)}`)
    doc.fillColor(MUTED).fontSize(10)
    const count = data.interventions.length
    doc.text(count === 1 ? '1 intervención' : `${count} intervenciones`)
    separator()

    if (count === 0) {
      doc.fillColor(MUTED).fontSize(11).text('No hay intervenciones con los filtros elegidos.')
    }

    // ---- Intervenciones (la más reciente arriba) ----
    for (const item of data.interventions) {
      ensureSpace(MIN_SPACE_FOR_ITEM)

      const section = item.classSection
        ? ` · ${item.classSection.grade}° ${item.classSection.division}`
        : ''
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(12)
      doc.text(`${formatSchoolDay(item.date)} · ${EVENT_TYPE_LABELS[item.eventType]}${section}`)

      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      const attachments =
        item.attachmentsCount === 1 ? '1 adjunto' : `${item.attachmentsCount} adjuntos`
      doc.text(`Registró: ${item.author.lastName}, ${item.author.firstName} · ${attachments}`)
      doc.moveDown(0.4)

      const field = (label: string, value: string | null) => {
        if (!value) return
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(label)
        doc.font('Helvetica').text(value)
        doc.moveDown(0.3)
      }
      field('Situación detectada', item.description)
      field('Propuesta de intervención', item.interventionProposal)
      field('Actores involucrados', item.involvedActors)

      separator()
    }

    // ---- Pie de página en todas las hojas ----
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      // Sin margen inferior, para que escribir en el pie no agregue una página nueva
      const bottomMargin = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      doc.text(
        `Documento de uso institucional: contiene datos personales de un/a estudiante. Página ${i + 1} de ${range.count}`,
        left,
        doc.page.height - 35,
        { width: contentWidth, align: 'center' }
      )
      doc.page.margins.bottom = bottomMargin
    }

    doc.end()
  })
}
