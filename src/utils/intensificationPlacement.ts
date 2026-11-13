import { IntensificationModel, type Shift } from '@prisma/client'

import { HttpError } from '@/utils/httpError'

// Sección donde intensifica un alumno en los modelos 2 y 3 (E3-RF-07)
export type TargetSection = { grade: number; shift: Shift }

// Modelo y ubicación (E3-RF-06 y 07): en los modelos 2 y 3, la sección tiene que ser del año de la
// materia; en el 2, del mismo turno del alumno, y en el 3, de otro turno (contraturno).
// Si el alumno no tiene curso en el ciclo activo, no se puede validar el turno: se rechaza.
export function assertPlacement(
  model: IntensificationModel,
  section: TargetSection | null,
  subjectGradeLevel: number,
  studentShift: Shift | undefined,
  name: string
) {
  if (!section) return

  if (section.grade !== subjectGradeLevel) {
    throw new HttpError(
      409,
      `${name}: la sección tiene que ser de ${subjectGradeLevel}° año, el año de la materia`
    )
  }
  if (!studentShift) {
    throw new HttpError(
      409,
      `${name} no tiene curso en el ciclo activo: no se puede validar el turno`
    )
  }
  if (model === IntensificationModel.MODEL_2 && section.shift !== studentShift) {
    throw new HttpError(409, `${name}: en el modelo 2 la sección tiene que ser de su mismo turno`)
  }
  if (model === IntensificationModel.MODEL_3 && section.shift === studentShift) {
    throw new HttpError(
      409,
      `${name}: en el modelo 3 la sección tiene que ser de otro turno (contraturno)`
    )
  }
}
