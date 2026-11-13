// Tipos de archivo permitidos como evidencia de una intervención (CRM-087, criterio 2).
// No alcanza con el tipo que manda el navegador (se puede falsear): se revisan la extensión
// y los primeros bytes del archivo ("firma" o magic number de cada formato).

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB por archivo
export const MAX_ATTACHMENTS_PER_UPLOAD = 10

interface AllowedType {
  mimeType: string
  extensions: string[]
  signature: number[] // bytes con los que empieza el archivo
}

const ALLOWED_TYPES: AllowedType[] = [
  { mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'], signature: [0xff, 0xd8, 0xff] },
  {
    mimeType: 'image/png',
    extensions: ['.png'],
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mimeType: 'application/pdf', extensions: ['.pdf'], signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  {
    // Un .docx es un ZIP por dentro: empieza con PK
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
]

export const ALLOWED_EXTENSIONS = ALLOWED_TYPES.flatMap((t) => t.extensions)

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase()
}

// Devuelve el tipo (MIME) y la extensión normalizada si el archivo está permitido,
// o null si la extensión no está permitida o el contenido no coincide con ella.
export function detectAttachmentType(
  fileName: string,
  content: Uint8Array
): { mimeType: string; extension: string } | null {
  const extension = getExtension(fileName)
  const type = ALLOWED_TYPES.find((t) => t.extensions.includes(extension))
  if (!type) return null
  const matches = type.signature.every((byte, i) => content[i] === byte)
  return matches ? { mimeType: type.mimeType, extension } : null
}
