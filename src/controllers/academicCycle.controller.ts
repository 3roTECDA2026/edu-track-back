import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createCycle = async (req: Request, res: Response) => {
  try {
    const { year, startDate, endDate } = req.body;

    const newCycle = await prisma.academicCycle.create({
      data: {
        year: Number(year),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    return res.status(201).json(newCycle);
  } catch (error) {
    return res.status(400).json({ error: 'Error al crear el ciclo lectivo o el año ya existe.' });
  }
};

export const getAllCycles = async (_req: Request, res: Response) => {
  try {
    const cycles = await prisma.academicCycle.findMany({
      orderBy: { year: 'desc' },
    });
    return res.json(cycles);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener los ciclos lectivos.' });
  }
};

export const getActiveCycle = async (_req: Request, res: Response) => {
  try {
    const activeCycle = await prisma.academicCycle.findFirst({
      where: { isActive: true },
    });

    if (!activeCycle) {
      return res.status(404).json({ message: 'No hay ningún ciclo lectivo activo actualmente.' });
    }

    return res.json(activeCycle);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener el ciclo activo.' });
  }
};

export const activateCycle = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const updatedCycle = await prisma.$transaction(async (tx) => {
     
      await tx.academicCycle.updateMany({
        data: { isActive: false },
      });

      const activated = await tx.academicCycle.update({
        where: { id: Number(id) },
        data: { isActive: true },
      });

      return activated;
    });

    return res.json({ message: 'Ciclo lectivo activado correctamente', cycle: updatedCycle });
  } catch (error) {
    return res.status(400).json({ error: 'Error al activar el ciclo lectivo.' });
  }
};
