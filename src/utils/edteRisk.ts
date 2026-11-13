import { PreliminaryAssessment } from '@prisma/client'

// Reglas del semáforo del dashboard del EDTE (E4-RF-05, CRM-077). Son funciones puras, sin base de
// datos, para poder probarlas.

// Umbrales del semáforo. Para cambiar una regla, se cambia acá y nada más: el endpoint los informa
// y el front arma sus textos con lo que recibe.
export const EDTE_RISK_THRESHOLDS = {
  // Materias pendientes (MPAA): 4 es alerta temprana y 5 o más se deriva al EDTE
  // (E6-RF-02; Res. 1650/24, A5, inc. 13; RN-012)
  earlyWarningPending: 4,
  referredPending: 5,
  // Materias con TED en el cuatrimestre: una TED dispara la alerta (E6-RF-03)
  mediumTedCount: 1,
  // Dos o más TED = riesgo alto. Es una propuesta del equipo, no sale de un requerimiento: es la
  // regla más fácil de revisar
  highTedCount: 2,
} as const

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

// Orden del listado: de rojo a verde
export const RISK_LEVEL_ORDER: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW']

// Peor valoración primero: TED (discontinua) > TEP (en proceso) > TEA (avanzada)
const ASSESSMENT_SEVERITY: PreliminaryAssessment[] = [
  PreliminaryAssessment.TED,
  PreliminaryAssessment.TEP,
  PreliminaryAssessment.TEA,
]

// La peor valoración de una lista de valoraciones, o null si no hay ninguna
export function worstAssessment(assessments: PreliminaryAssessment[]) {
  return ASSESSMENT_SEVERITY.find((value) => assessments.includes(value)) ?? null
}

// Semáforo de un alumno: rojo con 5 o más MPAA o 2 o más TED; ámbar con 4 MPAA, 1 TED o valoración
// TEP; verde el resto
export function riskLevel(
  pendingCount: number,
  tedCount: number,
  assessment: PreliminaryAssessment | null
): RiskLevel {
  const t = EDTE_RISK_THRESHOLDS
  if (pendingCount >= t.referredPending || tedCount >= t.highTedCount) return 'HIGH'
  if (pendingCount >= t.earlyWarningPending || tedCount >= t.mediumTedCount) return 'MEDIUM'
  if (assessment === PreliminaryAssessment.TEP) return 'MEDIUM'
  return 'LOW'
}

// Alerta temprana: justo una MPAA antes de derivarse (con 4; con 5 o más ya es derivado)
export const isEarlyWarning = (pendingCount: number) =>
  pendingCount >= EDTE_RISK_THRESHOLDS.earlyWarningPending &&
  pendingCount < EDTE_RISK_THRESHOLDS.referredPending

export const isReferred = (pendingCount: number) =>
  pendingCount >= EDTE_RISK_THRESHOLDS.referredPending

// Trayectoria compleja (entra en el listado): 4 o más MPAA, alguna TED en el cuatrimestre o PATE
// en curso
export const isComplexTrajectory = (pendingCount: number, tedCount: number, hasPate: boolean) =>
  pendingCount >= EDTE_RISK_THRESHOLDS.earlyWarningPending || tedCount > 0 || hasPate
