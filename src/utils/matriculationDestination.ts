import { PromotionOutcome, StudentStatus } from '@prisma/client'

export type DestinationStatus =
  | 'enrolled'
  | 'pendingPate'
  | 'pendingOrientation'
  | 'graduates'
  | 'missingDecision'
  | 'missingSection'
  | 'alreadyEnrolled'
  | 'skippedStatus'

export interface DestinationDecisionInput {
  student: {
    id: string
    firstName: string
    lastName: string
    status: StudentStatus
  }
  promotionDecision?: {
    outcome: PromotionOutcome
    pendingCount: number
  } | null
  currentSection?: {
    id: string
    grade: number
    division: string
    shift: string
    orientation?: string | null
  } | null
  targetSections: Array<{
    id: string
    grade: number
    division: string
    shift: string
    orientation?: string | null
  }>
  alreadyEnrolledInTarget: boolean
}

export interface DestinationDecisionResult {
  studentId: string
  studentName: string
  status: DestinationStatus
  targetSectionId?: string
  targetSectionName?: string
  missingSectionDescription?: string
  reason?: string
}

/**
 * Función pura que calcula el destino de un estudiante en la matriculación continuada.
 * Sin dependencias de base de datos ni I/O para facilitar su prueba exhaustiva.
 */
export function decideDestination(input: DestinationDecisionInput): DestinationDecisionResult {
  const { student, promotionDecision, currentSection, targetSections, alreadyEnrolledInTarget } =
    input
  const studentName = `${student.lastName}, ${student.firstName}`.trim()

  // 1. Filtrar estudiantes no activos ni condicionales (bajas, egresados, traslados)
  if (student.status !== StudentStatus.ACTIVE && student.status !== StudentStatus.CONDITIONAL) {
    return {
      studentId: student.id,
      studentName,
      status: 'skippedStatus',
      reason: `Estado del estudiante (${student.status}) no elegible para matriculación continuada`,
    }
  }

  // 2. Si ya está matriculado en el ciclo destino
  if (alreadyEnrolledInTarget) {
    return {
      studentId: student.id,
      studentName,
      status: 'alreadyEnrolled',
      reason: 'El estudiante ya se encuentra inscripto en el ciclo lectivo de destino',
    }
  }

  // 3. Si no tiene sección origen asignada
  if (!currentSection) {
    return {
      studentId: student.id,
      studentName,
      status: 'missingSection',
      missingSectionDescription: 'Sin sección previa asignada',
      reason: 'El estudiante no tiene una sección registrada en el ciclo de origen',
    }
  }

  // 4. Estudiantes de 6.° año: egresan completando nivel secundario (con o sin MPAA pendientes)
  if (currentSection.grade === 6) {
    const pendingCount = promotionDecision?.pendingCount ?? 0
    const reason =
      pendingCount > 0
        ? `Egresa con ${pendingCount} materias pendientes`
        : 'Estudiante de 6.° año que completa el nivel secundario'
    return {
      studentId: student.id,
      studentName,
      status: 'graduates',
      reason,
    }
  }

  // 5. Exigir decisión del motor de promoción para el resto de los cursos
  if (!promotionDecision) {
    return {
      studentId: student.id,
      studentName,
      status: 'missingDecision',
      reason: 'No se registra decisión del motor de promoción para este estudiante',
    }
  }

  // 6. Estudiantes derivados al EDTE (5 o más MPAA)
  if (promotionDecision.outcome === PromotionOutcome.REFERRED_TO_EDTE) {
    return {
      studentId: student.id,
      studentName,
      status: 'pendingPate',
      reason: `Derivado al EDTE por ${promotionDecision.pendingCount} MPAA. La asignación se define mediante PATE`,
    }
  }

  // Si no promovió (solo se matricula automáticamente con PROMOTED)
  if (promotionDecision.outcome !== PromotionOutcome.PROMOTED) {
    return {
      studentId: student.id,
      studentName,
      status: 'missingDecision',
      reason: `Decisión de promoción no habilita matriculación automática: ${promotionDecision.outcome}`,
    }
  }

  // 7. Ingreso a 4.° año (desde 3.° año): asignación manual por elección de orientación
  if (currentSection.grade === 3) {
    return {
      studentId: student.id,
      studentName,
      status: 'pendingOrientation',
      reason:
        'Promueve al Ciclo Superior (4.° año). Requiere asignación manual por elección de orientación',
    }
  }

  // 8. Promoción regular a año siguiente (grade + 1)
  const nextGrade = currentSection.grade + 1
  const targetSection = targetSections.find((s) => {
    const matchGrade = s.grade === nextGrade
    const matchDivision = s.division.toUpperCase() === currentSection.division.toUpperCase()
    const matchShift = s.shift === currentSection.shift
    const matchOrientation = (s.orientation ?? null) === (currentSection.orientation ?? null)
    return matchGrade && matchDivision && matchShift && matchOrientation
  })

  if (!targetSection) {
    const missingDesc = `${nextGrade}° "${currentSection.division}" (${currentSection.shift}${
      currentSection.orientation ? `, ${currentSection.orientation}` : ''
    })`
    return {
      studentId: student.id,
      studentName,
      status: 'missingSection',
      missingSectionDescription: missingDesc,
      reason: `No existe la sección equivalente ${missingDesc} en el ciclo destino`,
    }
  }

  const targetSectionName = `${targetSection.grade}° "${targetSection.division}"`

  return {
    studentId: student.id,
    studentName,
    status: 'enrolled',
    targetSectionId: targetSection.id,
    targetSectionName,
    reason: `Promueve a ${targetSectionName}`,
  }
}
