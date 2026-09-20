// Instancia única del cliente de Prisma para toda la app.
// Se reutiliza entre recargas de tsx (dev) para no abrir conexiones de más.
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma
