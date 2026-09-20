import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import gradeRoutes from '@/routes/grade.routes';

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
app.use('/api/grades', gradeRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;
