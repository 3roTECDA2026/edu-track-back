import type { Response } from 'express'

// Formato estándar de éxito: { success, data, message }
export function sendSuccess<T>(res: Response, data: T, message: string, status = 200): void {
  res.status(status).json({ success: true, data, message })
}
