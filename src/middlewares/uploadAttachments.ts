import type { RequestHandler } from 'express'
import multer from 'multer'

import { MAX_ATTACHMENTS_PER_UPLOAD, MAX_ATTACHMENT_SIZE_BYTES } from '@/utils/attachmentFileType'
import { HttpError } from '@/utils/httpError'

// Campo del formulario multipart donde vienen los archivos.
export const ATTACHMENTS_FIELD = 'files'

// Los archivos quedan en memoria (Buffer) y no en disco: así el service valida su contenido
// y recién después los guarda con el almacenamiento que esté configurado (lib/storage).
// Los límites cortan la subida antes de leer un archivo enorme entero.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES, files: MAX_ATTACHMENTS_PER_UPLOAD },
}).array(ATTACHMENTS_FIELD, MAX_ATTACHMENTS_PER_UPLOAD)

const MAX_SIZE_MB = MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)

// Traduce los errores de multer a HttpError con mensajes en español; si no, el errorHandler
// respondería 500.
export const uploadAttachments: RequestHandler = (req, res, next) => {
  upload(req, res, (error: unknown) => {
    if (!error) return next()
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, `Cada archivo puede pesar como máximo ${MAX_SIZE_MB} MB`))
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          new HttpError(
            400,
            `Se pueden subir hasta ${MAX_ATTACHMENTS_PER_UPLOAD} archivos, en el campo "${ATTACHMENTS_FIELD}"`
          )
        )
      }
      return next(new HttpError(400, 'No se pudieron leer los archivos enviados'))
    }
    next(error)
  })
}
