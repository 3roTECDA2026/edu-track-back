import path from 'node:path'

import type { FileStorage } from '@/lib/storage/fileStorage'
import { LocalFileStorage } from '@/lib/storage/localFileStorage'

export type { FileStorage } from '@/lib/storage/fileStorage'

// Factory del almacenamiento de archivos (CRM-087). Elige la implementación según
// STORAGE_DRIVER del .env. Cuando la escuela defina dónde se guardan los archivos, se agrega
// la clase nueva y su caso acá; el resto del código no cambia.
export function createFileStorage(driver = process.env.STORAGE_DRIVER || 'local'): FileStorage {
  switch (driver) {
    case 'local':
      // || y no ??: si UPLOADS_DIR está vacío en el .env, también usamos la carpeta por defecto
      return new LocalFileStorage(process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads'))
    default:
      throw new Error(`STORAGE_DRIVER desconocido: "${driver}". Valores posibles: local`)
  }
}

// Instancia única, igual que `prisma` en lib/prisma.ts.
export const fileStorage = createFileStorage()
