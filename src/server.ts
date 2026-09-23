import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.ts';
import { errorHandler } from './middlewares/errorHandler.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor levantado correctamente' });
});

// Rutas de la API
app.use('/api', routes);

// Manejo de errores: siempre después de las rutas
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;