import { Router } from 'express'
import * as matriculationController from '@/controllers/matriculation.controller'

const router = Router()
router.post('/run', matriculationController.run)
export default router
