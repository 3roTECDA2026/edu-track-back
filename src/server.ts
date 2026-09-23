import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// Ruta de prueba del servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor levantado correctamente',
  });
});

// Ruta de prueba de la API
app.get('/api', (req, res) => {
  res.json({
    message: 'API de EduTrack funcionando correctamente',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;