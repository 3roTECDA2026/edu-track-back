
import 'dotenv/config'

import cors from 'cors'
import express from 'express'

import { errorHandler } from '@/middlewares/errorHandler'
import routes from '@/routes/index'

const app = express()

// Middlewares globales
app.use(cors())
app.use(express.json())

// Ruta de salud
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Servidor levantado correctamente',
  })
})

// Rutas principales: usuarios, autenticación y gestión escolar
app.use('/api', routes)

// Manejo global de errores
app.use(errorHandler)

export default app
