import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import attendanceRouter from './routes/attendance.routes.js';

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
app.use('/attendance', attendanceRouter);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;