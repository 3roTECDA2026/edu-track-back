import { Router } from 'express'
import * as promotionController from '@/controllers/promotion.controller'
import { verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

const router = Router()
router.post('/run', verifyToken, asyncHandler(promotionController.run))
export default router
