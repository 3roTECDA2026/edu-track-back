import express from 'express';
import type { Request, Response } from 'express';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/middlewares/auth.middleware';

const router = express.Router();

// Endpoint POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Capturamos 'user' (el email que viene desde el front) y 'password'
    const { user, password } = req.body;

    if (!user || !password) {
      return res.status(400).json({ message: 'Por favor, ingresá tu usuario y contraseña.' });
    }

    // Buscamos al usuario en la base de datos por email
    const dbUser = await prisma.user.findFirst({
      where: { email: user },
    });

    if (!dbUser) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Validamos la contraseña usando bcrypt
    const isPasswordValid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Un usuario suspendido desde la pantalla de Usuarios no puede iniciar sesión
    if (dbUser.status !== UserStatus.ACTIVE) {
      return res.status(403).json({ message: 'El usuario está suspendido. Consultá con la administración.' });
    }

    // Generamos el token JWT con vigencia de 24 horas (la clave sale del .env)
    const token = jwt.sign(
      {
        userId: dbUser.id,
        role: dbUser.role,
        name: `${dbUser.firstName} ${dbUser.lastName}`,
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    // Respondemos con el token y los datos básicos del usuario
    return res.status(200).json({
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      },
    });
  } catch (error) {
    console.error('Error en el login:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;