import { Router } from 'express'

import * as cycleController from '@/controllers/cycle.controller'
import { asyncHandler } from '@/utils/asyncHandler'

export const cycleRouter = Router()

cycleRouter.get('/', asyncHandler(cycleController.listCycles))
cycleRouter.get('/active', asyncHandler(cycleController.getActiveCycle))
cycleRouter.post('/', asyncHandler(cycleController.createCycle))
cycleRouter.patch('/:id/activate', asyncHandler(cycleController.activateCycle))
