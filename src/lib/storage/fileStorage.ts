// Contrato que cumple cualquier lugar donde guardemos archivos (disco local, Supabase, S3...).
// El resto del back usa solo estas funciones: no sabe ni le importa dónde queda el archivo.
// Para agregar otro almacenamiento, se crea una clase que implemente esta interfaz y se suma
// un caso en la factory (`index.ts`).
export interface FileStorage {
  // Guarda el contenido con esa clave. Falla si ya existe un archivo con la misma clave.
  save(key: string, data: Buffer): Promise<void>
  // Devuelve el contenido, o null si no hay ningún archivo con esa clave.
  read(key: string): Promise<Buffer | null>
  // Borra el archivo. Si no existe, no hace nada.
  remove(key: string): Promise<void>
}
