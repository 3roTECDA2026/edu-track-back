import type { InstitutionalConfig } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { UpdateInstitutionalConfigInput } from '@/schemas/institutionalConfig.schema'

// El modelo organizativo adoptado se sostiene por un minimo de 3 ciclos lectivos.
const MINIMUM_CYCLES = 3

// Agrega el flag calculado: ¿ya se cumplio el plazo minimo? (hoy >= minimumExpiryDate)
function withAlert(config: InstitutionalConfig | null) {
  if (!config) return null
  return {
    ...config,
    minimumPeriodMet: new Date() >= config.minimumExpiryDate,
  }
}

// GET: devuelve la configuracion vigente (singleton) o null si todavia no se configuro.
export async function getInstitutionalConfig() {
  const config = await prisma.institutionalConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  return withAlert(config)
}

// PUT: setea o actualiza el modelo organizativo. Calcula el vencimiento del plazo minimo.
export async function upsertInstitutionalConfig(input: UpdateInstitutionalConfigInput) {
  const adoptedAt = input.adoptedAt ?? new Date()
  const minimumExpiryDate = new Date(adoptedAt)
  minimumExpiryDate.setFullYear(minimumExpiryDate.getFullYear() + MINIMUM_CYCLES)

  const existing = await prisma.institutionalConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  const config = existing
    ? await prisma.institutionalConfig.update({
        where: { id: existing.id },
        data: { organizationalModel: input.organizationalModel, adoptedAt, minimumExpiryDate },
      })
    : await prisma.institutionalConfig.create({
        data: { organizationalModel: input.organizationalModel, adoptedAt, minimumExpiryDate },
      })

  return withAlert(config)
}