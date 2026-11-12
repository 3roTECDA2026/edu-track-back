import { Router } from 'express'

import * as edteDashboardController from '@/controllers/edteDashboard.controller'
import { verifyToken } from '@/middlewares/auth.middleware'
import { requireEdteAccess } from '@/middlewares/requireEdteAccess'
import { asyncHandler } from '@/utils/asyncHandler'

export const edteDashboardRouter = Router()

// Solo EOE/directivos y dirección (y, cuando esté CRM-071, los integrantes del EDTE)
edteDashboardRouter.use(verifyToken, requireEdteAccess)

edteDashboardRouter.get('/', asyncHandler(edteDashboardController.getEdteDashboard))
