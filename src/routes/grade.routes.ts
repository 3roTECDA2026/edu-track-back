import { Router } from 'express'
import {
  listGrades,
  createGrade,
  updateGrade,
  deleteGrade,
} from '@/controllers/grade.controller'

const router = Router()

router.get('/', listGrades) // GET    /api/grades
router.post('/', createGrade) // POST   /api/grades
router.put('/:id', updateGrade) // PUT    /api/grades/:id
router.delete('/:id', deleteGrade) // DELETE /api/grades/:id

export default router
