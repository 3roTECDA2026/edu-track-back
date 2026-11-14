import { MAX_SUBJECTS_PER_CYCLE } from '@/services/subjectEnrollmentLimit'

export interface CurriculumPlanSummary {
  id: string
  name: string
  // Map of gradeLevel to array of subjectIds in that curriculum
  subjectsByGrade: Map<number, string[]>
  // Set of all subjectIds in this curriculum across all grades
  allSubjectIds: Set<string>
}

export interface ResolveSubjectsInput {
  targetGrade: number
  sectionSubjectIds: string[]
  fallbackGradeSubjects: string[]
  studentSourceSubjectIds: string[]
  curriculums: CurriculumPlanSummary[]
}

export interface ResolveSubjectsResult {
  subjectIds: string[]
  missingCurriculum?: boolean
  exceedsLimit?: boolean
  curriculumName?: string
}

/**
 * Función pura que determina las materias a inscribir para un alumno según su año destino y plan de estudios.
 * - Para 1.° a 3.° año: materias comunes del año escolar (o materias de la sección si las tuviera).
 * - Para 4.°, 5.° y 6.° año: busca el Curriculum que contiene las materias del ciclo origen.
 *   Si encuentra un único plan, toma sus materias correspondientes al targetGrade.
 *   Si no hay materias en la sección y no se puede determinar un único plan (0 o más de 1), no adivina:
 *   devuelve lista vacía y marca missingCurriculum = true.
 * - Valida que no exceda MAX_SUBJECTS_PER_CYCLE (12).
 */
export function resolveTargetSubjects(input: ResolveSubjectsInput): ResolveSubjectsResult {
  const {
    targetGrade,
    sectionSubjectIds,
    fallbackGradeSubjects,
    studentSourceSubjectIds,
    curriculums,
  } = input

  // 1. Si la sección destino tiene materias explícitas vinculadas (CurriculumSubject con classSectionId), usarlas
  if (sectionSubjectIds.length > 0) {
    if (sectionSubjectIds.length > MAX_SUBJECTS_PER_CYCLE) {
      return { subjectIds: [], exceedsLimit: true }
    }
    return { subjectIds: sectionSubjectIds }
  }

  // 2. Para Ciclo Básico (1.°, 2.° y 3.° año): las materias son comunes a todas las divisiones
  if (targetGrade <= 3) {
    if (fallbackGradeSubjects.length > MAX_SUBJECTS_PER_CYCLE) {
      return { subjectIds: [], exceedsLimit: true }
    }
    return { subjectIds: fallbackGradeSubjects }
  }

  // 3. Para Ciclo Superior (4.°, 5.° y 6.° año): buscar el plan de estudios del alumno
  // Se identifica qué Curriculum contiene las materias que el alumno cursó en el ciclo de origen
  if (studentSourceSubjectIds.length > 0) {
    const matchingCurriculums = curriculums.filter((curr) => {
      // El curriculum coincide si contiene las materias del alumno de origen
      return studentSourceSubjectIds.some((sId) => curr.allSubjectIds.has(sId))
    })

    if (matchingCurriculums.length === 1) {
      const plan = matchingCurriculums[0]!
      const planSubjects = plan.subjectsByGrade.get(targetGrade) ?? []

      if (planSubjects.length > 0) {
        if (planSubjects.length > MAX_SUBJECTS_PER_CYCLE) {
          return {
            subjectIds: [],
            exceedsLimit: true,
            curriculumName: plan.name,
          }
        }
        return {
          subjectIds: planSubjects,
          curriculumName: plan.name,
        }
      }
    }
  }

  // Si no se encuentra un único plan para ciclo superior, no adivinar materias
  return {
    subjectIds: [],
    missingCurriculum: true,
  }
}
