import type { Request, Response } from 'express'

import { updateInstitutionalConfigSchema } from '@/schemas/institutionalConfig.schema'
import * as institutionalConfigService from '@/services/institutionalConfig.service'
import { sendSuccess } from '@/utils/apiResponse'

export async function getInstitutionalConfig(_req: Request, res: Response) {
  sendSuccess(
    res,
    await institutionalConfigService.getInstitutionalConfig(),
    'Configuración institucional obtenida correctamente'
  )
}

export async function updateInstitutionalConfig(req: Request, res: Response) {
  const data = updateInstitutionalConfigSchema.parse(req.body)
  sendSuccess(
    res,
    await institutionalConfigService.upsertInstitutionalConfig(data),
    'Modelo organizativo actualizado correctamente'
  )
}