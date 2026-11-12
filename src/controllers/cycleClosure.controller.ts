import type { Request, Response } from 'express'

import { getAuthUser } from '@/middlewares/auth.middleware'
import { academicYearIdParamSchema } from '@/schemas/cycleClosure.schema'
import * as cycleClosureService from '@/services/cycleClosure.service'
import { sendSuccess } from '@/utils/apiResponse'

// Quién ejecuta el cierre: sale del token, nunca del body (y la IP, para la auditoría)
function getActor(req: Request) {
  return { userId: getAuthUser(req).userId, ipAddress: req.ip ?? 'unknown' }
}

// Simula el cierre: devuelve el resumen sin escribir nada
export async function previewCycleClosure(req: Request, res: Response) {
  const { academicYearId } = academicYearIdParamSchema.parse(req.params)
  const summary = await cycleClosureService.closeCycle(academicYearId, getActor(req), {
    dryRun: true,
  })
  sendSuccess(res, summary, 'Vista previa del cierre del ciclo')
}

export async function closeCycle(req: Request, res: Response) {
  const { academicYearId } = academicYearIdParamSchema.parse(req.params)
  const summary = await cycleClosureService.closeCycle(academicYearId, getActor(req), {
    dryRun: false,
  })
  sendSuccess(res, summary, 'Ciclo lectivo cerrado correctamente')
}
