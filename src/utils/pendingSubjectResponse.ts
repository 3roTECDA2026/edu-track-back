// Respuesta de una MPAA para la pestaña "Materias pendientes" (CRM-097). Función pura, sin base de
// datos, para poder probar de dónde sale el año.

export interface PendingSubjectRecord {
  subject: { gradeLevel: number }
  // Cursada que originó la MPAA: guarda el año en que se cursó, si quedó registrado
  originEnrollment: { originalGradeLevel: number | null }
}

// Año de la MPAA: el de la cursada de origen y, si no quedó guardado, el de la materia. Es la misma
// regla que el RITE (ritePendingSubjects), la intensificación y el listado de derivación (CRM-073).
export function toPendingSubjectResponse<T extends PendingSubjectRecord>(record: T) {
  const { originEnrollment, ...rest } = record
  return {
    ...rest,
    gradeLevel: originEnrollment.originalGradeLevel ?? record.subject.gradeLevel,
  }
}
