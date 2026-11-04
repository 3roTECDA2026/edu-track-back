import { Router } from 'express'
import * as promotionController from '@/controllers/promotion.controller'

const router = Router()
router.post('/run', promotionController.run)
export default router
