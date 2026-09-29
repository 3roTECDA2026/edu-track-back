import { Router } from 'express';
import {
  getClassSections,
  getClassSectionById,
  createClassSection,
  updateClassSection,
  deleteClassSection,
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject
} from '../controllers/course.controller';

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