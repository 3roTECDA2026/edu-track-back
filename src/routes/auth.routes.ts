
import express from 'express'
import type { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'node:crypto'

import { sendPasswordResetEmail } from '../services/mail.service'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema'

const router = express.Router()
const prisma = new PrismaClient()

const RESET_TOKEN_DURATION = 15 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// LOGIN EXISTENTE
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { user, password } = req.body

    if (typeof user !== 'string' || typeof password !== 'string' ||
        !user.trim() || !password) {
      return res.status(400).json({
        message: 'Por favor, ingresá tu usuario y contraseña.',
      })
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.trim().toLowerCase() },
    })

    if (!dbUser) {
      return res.status(401).json({
        message: 'Credenciales inválidas.',
      })
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      dbUser.passwordHash
    )

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Credenciales inválidas.',
      })
    }

    if (dbUser.status !== 'ACTIVE') {
      return res.status(403).json({
        message: 'La cuenta no está activa.',
      })
    }

    const jwtSecret = process.env.JWT_SECRET

    if (!jwtSecret) {
      console.error('JWT_SECRET no está configurado')
      return res.status(500).json({
        message: 'Error de configuración del servidor.',
      })
    }

    const token = jwt.sign(
      {
        userId: dbUser.id,
        role: dbUser.role,
        name: `${dbUser.firstName} ${dbUser.lastName}`,
      },
      jwtSecret,
      { expiresIn: '24h' }
    )

    return res.status(200).json({
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      },
    })
  } catch (error) {
    console.error('Error en login:', error)
    return res.status(500).json({
      message: 'Error interno del servidor.',
    })
  }
})

// SOLICITAR RECUPERACIÓN
router.post('/forgot-password', async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Ingresá un correo electrónico válido.',
    })
  }

  const genericMessage =
    'Si el correo está registrado, recibirás un enlace de recuperación.'

  try {
    const { email } = parsed.data

    const dbUser = await prisma.user.findUnique({
      where: { email },
    })

    // No revelar si el correo existe.
    if (!dbUser || dbUser.status !== 'ACTIVE') {
      return res.status(200).json({ message: genericMessage })
    }

    const frontendUrl = process.env.FRONTEND_URL

    if (!frontendUrl) {
      throw new Error('FRONTEND_URL no configurada')
    }

    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION)

    await prisma.passwordResetToken.create({
      data: {
        userId: dbUser.id,
        tokenHash,
        expiresAt,
      },
    })

    const resetUrl =
      `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`

    try {
      await sendPasswordResetEmail(dbUser.email, resetUrl)
    } catch (mailError) {
      // Eliminar el token si no se pudo enviar el correo.
      await prisma.passwordResetToken.delete({
        where: { tokenHash },
      })
      throw mailError
    }

    return res.status(200).json({
      message: genericMessage,
    })
  } catch (error) {
    console.error('Error al solicitar recuperación:', error)

    return res.status(200).json({
      message: genericMessage,
    })
  }
})

// RESTABLECER CONTRASEÑA
router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Token o contraseña inválidos.',
    })
  }

  try {
    const { token, password } = parsed.data
    const tokenHash = hashToken(token)

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (
      !resetRecord ||
      resetRecord.usedAt !== null ||
      resetRecord.expiresAt <= new Date()
    ) {
      return res.status(400).json({
        message: 'El enlace es inválido o ha vencido.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // La actualización condicional evita reutilizar el token
    // incluso ante dos solicitudes simultáneas.
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetRecord.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: 'ACTIVE' },
        },
        data: { usedAt: new Date() },
      })

      if (claimed.count !== 1) {
        return false
      }

      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      })

      // Invalidar otros enlaces pendientes del mismo usuario.
      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetRecord.userId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      })

      return true
    })

    if (!updated) {
      return res.status(400).json({
        message: 'El enlace es inválido o ha vencido.',
      })
    }

    return res.status(200).json({
      message: 'Contraseña actualizada correctamente.',
    })
  } catch (error) {
    console.error('Error al restablecer contraseña:', error)

    return res.status(500).json({
      message: 'No se pudo actualizar la contraseña.',
    })
  }
})

export default router
