import { Router } from 'express'

import * as gradeController from '@/controllers/grade.controller'
import { asyncHandler } from '@/utils/asyncHandler'

export const gradeRouter = Router()

gradeRouter.get('/', asyncHandler(gradeController.listGrades))
gradeRouter.post('/', asyncHandler(gradeController.createGrade))
gradeRouter.put('/:id', asyncHandler(gradeController.updateGrade))
gradeRouter.delete('/:id', asyncHandler(gradeController.deleteGrade))
