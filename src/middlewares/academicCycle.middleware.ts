import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CustomRequest extends Request {
  activeCycle?: any;
}

export const requireActiveCycle = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const activeCycle = await prisma.academicCycle.findFirst({
      where: { isActive: true },
    });

    if (!activeCycle) {
      return res.status(400).json({ error: 'Operación no permitida: No hay un ciclo lectivo activo.' });
    }

    req.activeCycle = activeCycle;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar el ciclo lectivo activo.' });
  }
};
