// Encabezado Content-Disposition para descargar un archivo con su nombre original (CRM-060).
// - filename*: el nombre completo en UTF-8 (tildes, ñ), para los navegadores actuales.
// - filename: una versión solo ASCII, de respaldo, sin comillas, barras ni saltos de línea, que
//   romperían el encabezado.
export function attachmentDisposition(fileName: string): string {
  const fallback =
    fileName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // saca tildes: "evaluación" → "evaluacion"
      .replace(/[^\x20-\x7e]/g, '_') // otros caracteres no ASCII
      .replace(/["\\/;\r\n]/g, '_') // caracteres que rompen el encabezado
      .trim() || 'archivo'
  // encodeURIComponent no codifica ' ( ) *, que en filename* sí hay que codificar (RFC 5987)
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}
