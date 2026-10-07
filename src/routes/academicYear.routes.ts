import { Router } from 'express'

import {
  activateAcademicYear,
  createAcademicYear,
  getCurrentAcademicYear,
  listAcademicYears,
  updateAcademicYear,
} from '@/controllers/academicYear.controller'
import { asyncHandler } from '@/utils/asyncHandler'

export const academicYearRouter = Router()

academicYearRouter.get('/', asyncHandler(listAcademicYears))
academicYearRouter.get('/current', asyncHandler(getCurrentAcademicYear))
academicYearRouter.post('/', asyncHandler(createAcademicYear))
academicYearRouter.patch('/:id/activate', asyncHandler(activateAcademicYear))
academicYearRouter.patch('/:id', asyncHandler(updateAcademicYear))
