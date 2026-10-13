
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { errorHandler } from '@/middlewares/errorHandler'
import authRoutes from '@/routes/auth.routes'
import routes from '@/routes/index'

// Cargar variables de entorno
dotenv.config()

// Inicializar Express
const app = express()
const PORT = process.env.PORT || 3000

// ========================================
// MIDDLEWARES GLOBALES
// ========================================

app.use(cors())
app.use(express.json())

// ========================================
// RUTA DE SALUD DEL SERVIDOR
// ========================================

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Servidor levantado correctamente',
  })
})

// ========================================
// RUTAS DE AUTENTICACIÓN
// ========================================

app.use('/api/auth', authRoutes)

// ========================================
// RUTAS PRINCIPALES DE LA API
// ========================================

app.use('/api', routes)

// ========================================
// MANEJO GLOBAL DE ERRORES
// ========================================

app.use(errorHandler)

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
  console.log(` Login: http://localhost:${PORT}/api/auth/login`)
  console.log(` Health: http://localhost:${PORT}/health`)
})

export default app
