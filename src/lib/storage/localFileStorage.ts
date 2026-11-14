import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { FileStorage } from '@/lib/storage/fileStorage'

// Guarda los archivos en una carpeta del servidor. La carpeta no se sirve como estática:
// los archivos solo salen por los endpoints, que validan token y permisos.
export class LocalFileStorage implements FileStorage {
  private readonly baseDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
  }

  // Convierte la clave en una ruta dentro de la carpeta base. Rechaza claves como
  // '../../etc/passwd', que apuntarían fuera de la carpeta.
  private resolvePath(key: string): string {
    const fullPath = path.resolve(this.baseDir, key)
    if (!fullPath.startsWith(this.baseDir + path.sep)) {
      throw new Error(`Clave de archivo inválida: ${key}`)
    }
    return fullPath
  }

  async save(key: string, data: Buffer): Promise<void> {
    const fullPath = this.resolvePath(key)
    await mkdir(path.dirname(fullPath), { recursive: true })
    // 'wx': falla si el archivo ya existe, para no pisar otro adjunto
    await writeFile(fullPath, data, { flag: 'wx' })
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolvePath(key))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true })
  }
}
