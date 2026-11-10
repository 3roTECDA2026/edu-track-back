import { Router } from 'express'
import { Role } from '@prisma/client'
import * as promotionController from '@/controllers/promotion.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'
import { asyncHandler } from '@/utils/asyncHandler'

const router = Router()

router.post(
  '/run',
  verifyToken,
  requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT),
  asyncHandler(promotionController.run)
)

export const promotionRouter = router
export default router

