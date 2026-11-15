import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MAX_SUBJECTS_PER_CYCLE } from '@/services/subjectEnrollmentLimit'
import { resolveTargetSubjects, type CurriculumPlanSummary } from './resolveTargetSubjects'

describe('CRM-064: resolveTargetSubjects (Asignación de materias por orientación)', () => {
  // Plan de Ciencias Naturales: 12 materias en 4.° y 12 materias en 5.°
  const nat4Subjects = Array.from({ length: 12 }, (_, i) => `nat-4-${i + 1}`)
  const nat5Subjects = Array.from({ length: 12 }, (_, i) => `nat-5-${i + 1}`)

  // Plan de Ciencias Sociales: 12 materias en 4.° y 12 materias en 5.°
  const soc4Subjects = Array.from({ length: 12 }, (_, i) => `soc-4-${i + 1}`)
  const soc5Subjects = Array.from({ length: 12 }, (_, i) => `soc-5-${i + 1}`)

  // Todas las materias de 5.° juntas (24 materias)
  const allGrade5Subjects = [...nat5Subjects, ...soc5Subjects]

  const curriculums: CurriculumPlanSummary[] = [
    {
      id: 'curr-naturales',
      name: 'Ciencias Naturales',
      subjectsByGrade: new Map([
        [4, nat4Subjects],
        [5, nat5Subjects],
      ]),
      allSubjectIds: new Set([...nat4Subjects, ...nat5Subjects]),
    },
    {
      id: 'curr-sociales',
      name: 'Ciencias Sociales',
      subjectsByGrade: new Map([
        [4, soc4Subjects],
        [5, soc5Subjects],
      ]),
      allSubjectIds: new Set([...soc4Subjects, ...soc5Subjects]),
    },
  ]

  it('alumno de 4.° de Naturales que promueve a 5.° recibe solo sus 12 materias de Naturales y no las 24 del año', () => {
    const res = resolveTargetSubjects({
      targetGrade: 5,
      sectionSubjectIds: [], // La sección destino no tiene CurriculumSubject explícito
      fallbackGradeSubjects: allGrade5Subjects, // Fallback con todas las materias de 5.° (24)
      studentSourceSubjectIds: nat4Subjects, // Alumno cursó 4.° de Naturales
      curriculums,
    })

    assert.equal(res.subjectIds.length, 12)
    assert.equal(res.subjectIds.length <= MAX_SUBJECTS_PER_CYCLE, true)
    assert.deepEqual(res.subjectIds, nat5Subjects)
    assert.equal(res.curriculumName, 'Ciencias Naturales')
    assert.equal(res.missingCurriculum, undefined)
  })

  it('alumno de 4.° de Sociales que promueve a 5.° recibe solo sus 12 materias de Sociales', () => {
    const res = resolveTargetSubjects({
      targetGrade: 5,
      sectionSubjectIds: [],
      fallbackGradeSubjects: allGrade5Subjects,
      studentSourceSubjectIds: soc4Subjects,
      curriculums,
    })

    assert.equal(res.subjectIds.length, 12)
    assert.deepEqual(res.subjectIds, soc5Subjects)
    assert.equal(res.curriculumName, 'Ciencias Sociales')
  })

  it('alumno de 1.° a 3.° año (Ciclo Básico) recibe las materias comunes del año', () => {
    const basicSubjects = ['mat-2', 'lengua-2', 'soc-2', 'nat-2']
    const res = resolveTargetSubjects({
      targetGrade: 2,
      sectionSubjectIds: [],
      fallbackGradeSubjects: basicSubjects,
      studentSourceSubjectIds: ['mat-1', 'lengua-1'],
      curriculums,
    })

    assert.equal(res.subjectIds.length, 4)
    assert.deepEqual(res.subjectIds, basicSubjects)
  })

  it('si no se puede determinar un único plan para ciclo superior, no adivina y marca missingCurriculum', () => {
    const res = resolveTargetSubjects({
      targetGrade: 5,
      sectionSubjectIds: [],
      fallbackGradeSubjects: allGrade5Subjects,
      studentSourceSubjectIds: ['unknown-subject-id'],
      curriculums,
    })

    assert.equal(res.subjectIds.length, 0)
    assert.equal(res.missingCurriculum, true)
  })

  it('si un plan excede el límite de 12 materias, marca exceedsLimit', () => {
    const oversizedCurriculum: CurriculumPlanSummary[] = [
      {
        id: 'curr-big',
        name: 'Plan Sobrecargado',
        subjectsByGrade: new Map([[5, Array.from({ length: 15 }, (_, i) => `sub-${i}`)]]),
        allSubjectIds: new Set(['source-1']),
      },
    ]

    const res = resolveTargetSubjects({
      targetGrade: 5,
      sectionSubjectIds: [],
      fallbackGradeSubjects: [],
      studentSourceSubjectIds: ['source-1'],
      curriculums: oversizedCurriculum,
    })

    assert.equal(res.exceedsLimit, true)
    assert.equal(res.subjectIds.length, 0)
  })

  it('resuelve correctamente la orientación cuando comparten materias comunes en 4.° año (evaluación con every)', () => {
    // Materias comunes en 4.° (Matemática, Literatura, Inglés, etc.)
    const common4Subjects = ['com-mat', 'com-lit', 'com-ing', 'com-bio', 'com-ef', 'com-nticx']
    // Específica de Naturales en 4.°: Introducción a la Química
    const natSpecific4 = 'nat-intro-quimica'
    // Específica de Sociales en 4.°: Psicología
    const socSpecific4 = 'soc-psicologia'

    const nat5 = ['nat5-quimica', 'nat5-fisica', 'nat5-biologia']
    const soc5 = ['soc5-sociologia', 'soc5-comunicacion', 'soc5-historia']

    const sharedCurriculums: CurriculumPlanSummary[] = [
      {
        id: 'curr-nat',
        name: 'Ciencias Naturales',
        subjectsByGrade: new Map([
          [4, [...common4Subjects, natSpecific4]],
          [5, nat5],
        ]),
        allSubjectIds: new Set([...common4Subjects, natSpecific4, ...nat5]),
      },
      {
        id: 'curr-soc',
        name: 'Ciencias Sociales',
        subjectsByGrade: new Map([
          [4, [...common4Subjects, socSpecific4]],
          [5, soc5],
        ]),
        allSubjectIds: new Set([...common4Subjects, socSpecific4, ...soc5]),
      },
    ]

    // El alumno cursó las comunes + Introducción a la Química de Naturales
    const res = resolveTargetSubjects({
      targetGrade: 5,
      sectionSubjectIds: [],
      fallbackGradeSubjects: [...nat5, ...soc5],
      studentSourceSubjectIds: [...common4Subjects, natSpecific4],
      curriculums: sharedCurriculums,
    })

    // Debe coincidir únicamente con Ciencias Naturales porque Sociales no contiene 'nat-intro-quimica'
    assert.equal(res.missingCurriculum, undefined)
    assert.equal(res.curriculumName, 'Ciencias Naturales')
    assert.deepEqual(res.subjectIds, nat5)
  })
})
