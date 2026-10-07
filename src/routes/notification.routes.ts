import { AlertSeverity, AlertType } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'

const router = Router()

const backendAlertTypeSchema = z.enum([
  'ABSENCES',
  'PENDING_SUBJECTS',
  'TED_ASSESSMENT',
  'DROPOUT_RISK',
  'HEALTH',
  'CONDUCT',
])
const alertSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])

const createNotificationSchema = z.object({
  studentId: z.string().min(1),
  type: backendAlertTypeSchema,
  severity: alertSeveritySchema.optional(),
  message: z.string().min(1),
  read: z.boolean().optional().default(false),
})

const updateNotificationSchema = z.object({
  type: backendAlertTypeSchema.optional(),
  severity: alertSeveritySchema.optional(),
  message: z.string().min(1).optional(),
  read: z.boolean().optional(),
})

const mapDbTypeToUi = (type: AlertType): 'ABSENCE' | 'HEALTH' | 'CONDUCT' | 'ACADEMIC' => {
  switch (type) {
    case 'HEALTH':
      return 'HEALTH'
    case 'CONDUCT':
      return 'CONDUCT'
    case 'ABSENCES':
      return 'ABSENCE'
    default:
      return 'ACADEMIC'
  }
}

const deriveSeverity = (type: AlertType): 'LOW' | 'MEDIUM' | 'HIGH' => {
  switch (type) {
    case 'ABSENCES':
      return 'HIGH'
    case 'HEALTH':
      return 'MEDIUM'
    case 'CONDUCT':
      return 'MEDIUM'
    default:
      return 'LOW'
  }
}

const formatShift = (shift: string): string => {
  const labels: Record<string, string> = {
    MORNING: 'Mañana',
    AFTERNOON: 'Tarde',
    EVENING: 'Vespertino',
    EXTRA_TIME: 'Contraturno',
  }

  return labels[shift] ?? shift
}

const mapToUiPayload = (notification: {
  id: string
  studentId: string
  type: AlertType
  severity: AlertSeverity
  message: string
  read: boolean
  createdAt: Date
  student: {
    id: string
    firstName: string
    lastName: string
    enrollmentHistory: {
      classSection: {
        grade: number
        division: string
        shift: string
      }
    }[]
  }
}) => {
  const section = notification.student.enrollmentHistory[0]?.classSection
  const uiType = mapDbTypeToUi(notification.type)

  return {
    id: notification.id,
    studentId: notification.studentId,
    studentName: `${notification.student.lastName}, ${notification.student.firstName}`,
    sectionName: section
      ? `${section.grade}° ${section.division} (${formatShift(section.shift)})`
      : 'Sin curso asignado',
    type: uiType,
    severity: notification.severity,
    title:
      notification.type === AlertType.HEALTH
        ? 'Salud / reposo'
        : notification.type === AlertType.CONDUCT
          ? 'Mala conducta'
          : notification.type === AlertType.ABSENCES
            ? 'Inasistencias'
            : 'Rendimiento académico',
    description: notification.message,
    valueMetric:
      notification.type === AlertType.HEALTH
        ? 'Seguimiento de salud'
        : notification.type === AlertType.CONDUCT
          ? 'Convivencia'
          : notification.type === AlertType.ABSENCES
            ? 'Monitoreo de asistencia'
            : 'Rendimiento',
    createdAt: notification.createdAt.toISOString(),
    status: notification.read ? 'RESOLVED' : 'OPEN',
    note: notification.message,
  }
}

router.get('/', async (_req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          enrollmentHistory: {
            orderBy: [{ startDate: 'desc' }],
            take: 1,
            select: {
              classSection: {
                select: {
                  grade: true,
                  division: true,
                  shift: true,
                },
              },
            },
          },
        },
      },
    },
  })

  res.json(notifications.map(mapToUiPayload))
})

router.post('/', async (req, res) => {
  const validated = createNotificationSchema.parse(req.body)

  const notification = await prisma.notification.create({
    data: {
      studentId: validated.studentId,
      type: validated.type,
      severity: validated.severity ?? deriveSeverity(validated.type),
      message: validated.message,
      read: validated.read,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          enrollmentHistory: {
            orderBy: [{ startDate: 'desc' }],
            take: 1,
            select: {
              classSection: {
                select: {
                  grade: true,
                  division: true,
                  shift: true,
                },
              },
            },
          },
        },
      },
    },
  })

  res.status(201).json(mapToUiPayload(notification))
})

router.patch('/:id', async (req, res) => {
  const idSchema = z.object({ id: z.string().min(1) })
  const params = idSchema.parse(req.params)
  const payload = updateNotificationSchema.parse(req.body)

  const notification = await prisma.notification.update({
    where: { id: params.id },
    data: {
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
      ...(payload.message !== undefined ? { message: payload.message } : {}),
      ...(payload.read !== undefined ? { read: payload.read } : {}),
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          enrollmentHistory: {
            orderBy: [{ startDate: 'desc' }],
            take: 1,
            select: {
              classSection: {
                select: {
                  grade: true,
                  division: true,
                  shift: true,
                },
              },
            },
          },
        },
      },
    },
  })

  res.json(mapToUiPayload(notification))
})

export default router
