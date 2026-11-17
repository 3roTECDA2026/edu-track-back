import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildInterventionTimelinePdf,
  describePeriod,
  formatSchoolDay,
  type TimelinePdfIntervention,
} from '@/utils/interventionTimelinePdf'

const student = { firstName: 'Ana', lastName: 'Pérez', dni: '40111222' }

const intervention = (overrides: Partial<TimelinePdfIntervention> = {}) => ({
  // 13/11/2026 a las 00:00 de Argentina (así se guardan las fechas de intervenciones)
  date: new Date('2026-11-13T03:00:00.000Z'),
  eventType: 'PEDAGOGICAL' as const,
  classSection: { grade: 3, division: 'A' },
  author: { firstName: 'Marcela', lastName: 'Quiroga' },
  description: 'No entrega las tareas desde hace dos semanas.',
  interventionProposal: 'Entrevista con la familia.',
  involvedActors: 'EOE, Madre',
  attachmentsCount: 2,
  ...overrides,
})

// Cantidad de páginas del PDF (cada página es un objeto "/Type /Page")
const countPages = (pdf: Buffer) =>
  (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length

describe('PDF de la línea de tiempo de intervenciones (CRM-088)', () => {
  it('genera un PDF aunque no haya intervenciones', async () => {
    const pdf = await buildInterventionTimelinePdf({
      student,
      filters: {},
      generatedOn: '2026-11-13',
      interventions: [],
    })
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    assert.equal(countPages(pdf), 1)
  })

  it('con muchas intervenciones pasa a otras páginas sin romperse', async () => {
    const long = 'Texto largo de la situación detectada. '.repeat(20)
    const pdf = await buildInterventionTimelinePdf({
      student,
      filters: { eventType: 'HEALTH', from: '2026-03-01', to: '2026-11-13' },
      generatedOn: '2026-11-13',
      interventions: Array.from({ length: 30 }, () =>
        intervention({ description: long, classSection: null, interventionProposal: null })
      ),
    })
    assert.ok(countPages(pdf) > 1)
  })

  it('la fecha se muestra en hora de Argentina', () => {
    // 03:00 UTC del 13 es todavía 13 en Argentina (y no 12)
    assert.equal(formatSchoolDay(new Date('2026-11-13T03:00:00.000Z')), '13/11/2026')
  })

  it('describe el período elegido en los filtros', () => {
    assert.equal(describePeriod(), 'Todas las fechas')
    assert.equal(describePeriod('2026-03-01'), 'Desde el 01/03/2026')
    assert.equal(describePeriod(undefined, '2026-11-13'), 'Hasta el 13/11/2026')
    assert.equal(describePeriod('2026-03-01', '2026-11-13'), 'Del 01/03/2026 al 13/11/2026')
  })
})
