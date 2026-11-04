import { AuditActionType, type InstitutionalConfig, type OrganizationalModel } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { UpdateInstitutionalConfigInput } from '@/schemas/institutionalConfig.schema'
import { HttpError } from '@/utils/httpError'

// El modelo organizativo adoptado se sostiene por un minimo de 3 ciclos lectivos.
const MINIMUM_CYCLES = 3

// Datos del usuario que hace el cambio, para la auditoria.
interface AuditActor {
  userId: string
  ipAddress: string
}

// Etiqueta corta de cada opcion, para los mensajes al usuario.
const MODEL_LABELS: Record<OrganizationalModel, string> = {
  OPTION_A: 'A',
  OPTION_B: 'B',
  OPTION_C: 'C',
  OPTION_D: 'D',
}

// Fecha en formato dd/mm/aaaa para los mensajes.
function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

// Convierte un registro a JSON plano (fechas a string) para guardarlo en AuditLog.
function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

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
  const config = await prisma.institutionalConfig.findUnique({
    where: { singleton: true },
  })
  return withAlert(config)
}

// PUT: setea o actualiza el modelo organizativo, respetando el plazo minimo de 3 ciclos.
export async function upsertInstitutionalConfig(
  input: UpdateInstitutionalConfigInput,
  actor: AuditActor
) {
  const config = await prisma.$transaction(async (tx) => {
    const existing = await tx.institutionalConfig.findUnique({
      where: { singleton: true },
    })

    // Mismo modelo: no se reinician las fechas de vigencia (operacion idempotente).
    if (existing && input.organizationalModel === existing.organizationalModel) {
      return existing
    }

    // Cambio de modelo con el plazo minimo todavia vigente: no se permite.
    if (existing && new Date() < existing.minimumExpiryDate) {
      throw new HttpError(
        409,
        `El modelo ${MODEL_LABELS[existing.organizationalModel]} rige hasta el ${formatDate(
          existing.minimumExpiryDate
        )}: no se puede cambiar antes.`
      )
    }

    // Primera configuracion o cambio ya habilitado: rige desde hoy por 3 ciclos.
    const adoptedAt = new Date()
    const minimumExpiryDate = new Date(adoptedAt)
    minimumExpiryDate.setFullYear(minimumExpiryDate.getFullYear() + MINIMUM_CYCLES)

    const data = {
      organizationalModel: input.organizationalModel,
      adoptedAt,
      minimumExpiryDate,
    }

    const saved = existing
      ? await tx.institutionalConfig.update({ where: { id: existing.id }, data })
      : await tx.institutionalConfig.create({ data })

    // Trazabilidad del cambio de modelo (CRM-065).
    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: existing ? AuditActionType.UPDATE : AuditActionType.CREATE,
        affectedEntity: 'InstitutionalConfig',
        entityId: saved.id,
        previousData: existing ? toJson(existing) : undefined,
        newData: toJson(saved),
        ipAddress: actor.ipAddress,
      },
    })

    return saved
  })

  return withAlert(config)
}
