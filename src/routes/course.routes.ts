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
  updateSubject
} from '@/controllers/course.controller';
import { Router } from 'express';

const router = Router();

// Rutas de Cursos / Divisiones (/api/class-sections)
router.get('/class-sections', getClassSections);
router.get('/class-sections/:id', getClassSectionById);
router.post('/class-sections', createClassSection);
router.put('/class-sections/:id', updateClassSection);
router.delete('/class-sections/:id', deleteClassSection);

// Rutas de Materias (/api/subjects)
router.get('/subjects', getSubjects);
router.get('/subjects/:id', getSubjectById);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

export default router;