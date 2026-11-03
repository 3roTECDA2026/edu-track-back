// Fechas de la escuela, compartidas por la asistencia diaria y la de intensificación (CRM-059).
// Las fechas viajan como texto AAAA-MM-DD y se guardan a las 00:00 UTC (columnas @db.Date).

// La escuela está en Argentina: "hoy" se calcula con esa hora, no con la del servidor (que puede estar en UTC)
export const SCHOOL_TIME_ZONE = 'America/Argentina/Buenos_Aires'

export const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
export const toDay = (value: Date) => value.toISOString().slice(0, 10)

// Fecha de hoy (AAAA-MM-DD) según la hora de Argentina
export function todayInSchoolTimeZone() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Sábado o domingo: esos días no se toma asistencia
export function isWeekend(date: string) {
  const weekDay = toDate(date).getUTCDay()
  return weekDay === 0 || weekDay === 6
}
