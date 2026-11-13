import { PendingSubjectStatus } from '@prisma/client'

// Reglas del recursado de una MPAA (CRM-082, Res. 1650/24, Anexo 5, incs. 13 a 17).
// Son funciones puras: el service hace las consultas y acá se decide si se puede.

export interface RepeatPendingInfo {
  status: PendingSubjectStatus
  originYear: number // Ciclo en que quedó pendiente
  gradeLevel: number // Año de la materia (1.º a 6.º)
  // Intentos de intensificación de la MPAA, para no intensificar y recursar a la vez
  attempts: Array<{ resultCode: string | null }>
}

export interface RepeatSectionInfo {
  academicYearId: string
  grade: number
}

export interface RepeatCycleInfo {
  id: string
  year: number
}

// Motivo por el que no se puede recursar la MPAA en esa sección, o null si se puede
export function repeatBlockReason(
  pending: RepeatPendingInfo,
  section: RepeatSectionInfo,
  activeCycle: RepeatCycleInfo
): string | null {
  if (pending.status !== PendingSubjectStatus.PENDING) {
    return 'La materia ya está acreditada: no se puede recursar'
  }
  // Se recursa en un ciclo posterior al que dejó la materia pendiente
  if (pending.originYear >= activeCycle.year) {
    return `La materia quedó pendiente en ${pending.originYear}: se recursa en un ciclo posterior`
  }
  return (
    sectionBlockReason(pending.gradeLevel, section, activeCycle) ?? attemptsBlockReason(pending)
  )
}

// La sección tiene que ser del ciclo activo y del mismo año que la materia. El turno puede ser
// otro que el del alumno: se puede recursar a contraturno (inc. 15).
export function sectionBlockReason(
  gradeLevel: number,
  section: RepeatSectionInfo,
  activeCycle: RepeatCycleInfo
): string | null {
  if (section.academicYearId !== activeCycle.id) {
    return `La sección elegida no es del ciclo ${activeCycle.year}, en el que se recursa`
  }
  if (section.grade !== gradeLevel) {
    return `La materia es de ${gradeLevel}.º año: la sección tiene que ser de ese año`
  }
  return null
}

// No se intensifica y se recursa a la vez: un intento sin resultado bloquea el recursado
function attemptsBlockReason(pending: RepeatPendingInfo): string | null {
  if (pending.attempts.some((attempt) => attempt.resultCode === null)) {
    return 'La materia tiene una intensificación sin resultado: cargá el resultado o quitá la asignación antes de recursarla'
  }
  return null
}

export interface RepeatUsage {
  hasGrade: boolean
  attendances: number
  intensifications: number
}

// Un recursado se quita solo si todavía no tiene notas, asistencia ni intensificaciones
export function deleteBlockReason(usage: RepeatUsage): string | null {
  if (usage.hasGrade) return 'El recursado ya tiene notas cargadas: no se puede quitar'
  if (usage.attendances > 0) return 'El recursado ya tiene asistencias cargadas: no se puede quitar'
  if (usage.intensifications > 0) {
    return 'El recursado tiene intensificaciones registradas: no se puede quitar'
  }
  return null
}
