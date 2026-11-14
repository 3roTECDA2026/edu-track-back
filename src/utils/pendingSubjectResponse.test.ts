import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { toPendingSubjectResponse } from './pendingSubjectResponse'

// MPAA de una materia de 1.º año
const record = (originalGradeLevel: number | null) => ({
  id: 'mpaa-1',
  subject: { id: 'mat', name: 'Matemática', gradeLevel: 1 },
  originEnrollment: { originalGradeLevel },
})

describe('año de una MPAA en la pestaña "Materias pendientes" (CRM-097)', () => {
  it('usa el año de la cursada de origen cuando quedó guardado', () => {
    assert.equal(toPendingSubjectResponse(record(2)).gradeLevel, 2)
  })

  it('sin año de origen, usa el de la materia', () => {
    assert.equal(toPendingSubjectResponse(record(null)).gradeLevel, 1)
  })

  it('no expone la cursada de origen y conserva el año de la materia', () => {
    const response = toPendingSubjectResponse(record(2))
    assert.equal('originEnrollment' in response, false)
    assert.equal(response.subject.gradeLevel, 1)
  })
})
