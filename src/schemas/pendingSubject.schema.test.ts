import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  listPendingSubjectsQuerySchema,
  pendingSubjectIdParamSchema,
  updatePendingKnowledgeSchema,
} from './pendingSubject.schema'

const GUID = '00000000-0000-0000-0000-000000000101'
const parse = (input: unknown) => updatePendingKnowledgeSchema.parse(input)

describe('guardar los saberes pendientes (validación)', () => {
  it('acepta solo los saberes iniciales', () => {
    assert.deepEqual(parse({ initialPendingKnowledge: 'Conectores' }), {
      initialPendingKnowledge: 'Conectores',
    })
  })

  it('recorta los espacios', () => {
    assert.deepEqual(parse({ closingPendingKnowledge: '  Argumentación  ' }), {
      closingPendingKnowledge: 'Argumentación',
    })
  })

  it('un texto en blanco se guarda como null', () => {
    assert.deepEqual(parse({ closingPendingKnowledge: '   ' }), { closingPendingKnowledge: null })
  })

  it('acepta null para borrar el campo', () => {
    assert.deepEqual(parse({ initialPendingKnowledge: null }), { initialPendingKnowledge: null })
  })

  it('rechaza un pedido sin ningún campo', () => {
    assert.throws(() => parse({}))
  })

  it('admite 2000 caracteres y rechaza 2001', () => {
    assert.doesNotThrow(() => parse({ closingPendingKnowledge: 'a'.repeat(2000) }))
    assert.throws(() => parse({ closingPendingKnowledge: 'a'.repeat(2001) }))
  })
})

describe('consulta e id de la MPAA (validación)', () => {
  it('la consulta pide el id del alumno', () => {
    assert.doesNotThrow(() => listPendingSubjectsQuerySchema.parse({ studentId: GUID }))
    assert.throws(() => listPendingSubjectsQuerySchema.parse({}))
    assert.throws(() => listPendingSubjectsQuerySchema.parse({ studentId: 'abc' }))
  })

  it('el id de la MPAA tiene que ser un guid', () => {
    assert.doesNotThrow(() => pendingSubjectIdParamSchema.parse({ id: GUID }))
    assert.throws(() => pendingSubjectIdParamSchema.parse({ id: 'abc' }))
  })
})
