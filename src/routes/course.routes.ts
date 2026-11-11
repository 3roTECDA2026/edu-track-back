import { Role } from '@prisma/client'
import { Router } from 'express'

import {
  createClassSection,
  createSubject,
  deleteClassSection,
  deleteSubject,
  getClassSectionById,
  getClassSections,
  getSubjectById,
  getSubjects,
  updateClassSection,
  updateSubject,
} from '@/controllers/course.controller'
import { requireRole, verifyToken } from '@/middlewares/auth.middleware'

const router = Router()

// Ver cursos y materias: personal de la escuela. Los usan los selectores de varias pantallas.
const canView = requireRole(
  Role.ADMINISTRATOR,
  Role.SCHOOL_MANAGEMENT,
  Role.EOE_DIRECTIVE,
  Role.TEACHER,
  Role.PRECEPTOR
)

// Crear, modificar y borrar cursos y materias: solo administración y dirección.
const canAdminister = requireRole(Role.ADMINISTRATOR, Role.SCHOOL_MANAGEMENT)

// Rutas de Cursos / Divisiones (/api/class-sections)
router.get('/class-sections', verifyToken, canView, getClassSections)
router.get('/class-sections/:id', verifyToken, canView, getClassSectionById)
router.post('/class-sections', verifyToken, canAdminister, createClassSection)
router.put('/class-sections/:id', verifyToken, canAdminister, updateClassSection)
router.delete('/class-sections/:id', verifyToken, canAdminister, deleteClassSection)

// Rutas de Materias (/api/subjects)
router.get('/subjects', verifyToken, canView, getSubjects)
router.get('/subjects/:id', verifyToken, canView, getSubjectById)
router.post('/subjects', verifyToken, canAdminister, createSubject)
router.put('/subjects/:id', verifyToken, canAdminister, updateSubject)
router.delete('/subjects/:id', verifyToken, canAdminister, deleteSubject)

export default router