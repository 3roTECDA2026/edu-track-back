import type { Request, Response } from 'express';
import {
  createClassSectionSchema,
  updateClassSectionSchema,
  createSubjectSchema,
  updateSubjectSchema
} from '../schemas/course.schema';
import {
  getAllClassSectionsService,
  getClassSectionByIdService,
  createClassSectionService,
  updateClassSectionService,
  deleteClassSectionService,
  getAllSubjectsService,
  getSubjectByIdService,
  createSubjectService,
  updateSubjectService,
  deleteSubjectService
} from '../services/course.service';

// --- CONTROLADORES DE CURSOS ---

export const getClassSections = async (_req: Request, res: Response) => {
  try {
    const sections = await getAllClassSectionsService();
    return res.status(200).json(sections);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener los cursos.' });
  }
};

export const getClassSectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const section = await getClassSectionByIdService(id);
    if (!section) return res.status(404).json({ error: 'Curso no encontrado.' });
    return res.status(200).json(section);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener el curso.' });
  }
};

export const createClassSection = async (req: Request, res: Response) => {
  try {
    const validatedData = createClassSectionSchema.parse(req.body);
    const newSection = await createClassSectionService(validatedData);
    return res.status(201).json(newSection);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: 'Error al crear el curso.' });
  }
};

export const updateClassSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateClassSectionSchema.parse(req.body);
    const updatedSection = await updateClassSectionService(id, validatedData);
    return res.status(200).json(updatedSection);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: 'Error al actualizar el curso.' });
  }
};

export const deleteClassSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteClassSectionService(id);
    return res.status(200).json({ message: 'Curso eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar el curso.' });
  }
};

// --- CONTROLADORES DE MATERIAS ---

export const getSubjects = async (_req: Request, res: Response) => {
  try {
    const subjects = await getAllSubjectsService();
    return res.status(200).json(subjects);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener las materias.' });
  }
};

export const getSubjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const subject = await getSubjectByIdService(id);
    if (!subject) return res.status(404).json({ error: 'Materia no encontrada.' });
    return res.status(200).json(subject);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener la materia.' });
  }
};

export const createSubject = async (req: Request, res: Response) => {
  try {
    const validatedData = createSubjectSchema.parse(req.body);
    const newSubject = await createSubjectService(validatedData);
    return res.status(201).json(newSubject);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: 'Error al crear la materia.' });
  }
};

export const updateSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateSubjectSchema.parse(req.body);
    const updatedSubject = await updateSubjectService(id, validatedData);
    return res.status(200).json(updatedSubject);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ errors: error.errors });
    return res.status(500).json({ error: 'Error al actualizar la materia.' });
  }
};

export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteSubjectService(id);
    return res.status(200).json({ message: 'Materia eliminada correctamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar la materia.' });
  }
};