# Guía de Seguridad para Desarrolladores Backend (edu-track-back)

Este documento describe el estado actual de la seguridad en el proyecto backend de Edu-Track.

## 1. Postura de Seguridad Actual: Implementación de Prototipo

La API de Edu-Track opera actualmente con una implementación de seguridad a nivel de prototipo. No hay autenticación ni autorización aplicadas.

*   **Estado de Autenticación:** todas las rutas bajo `/api/*` (`/students`, `/enrollments`, `/grades`, `/class-sections`, `/attendance`, cursos) son accesibles sin sesión ni token. Existe `src/schemas/auth.schema.ts` (`loginSchema`) pero no hay endpoint de login montado en `src/routes/index.ts` ni middleware de verificación.
*   **CORS:** abierto (`app.use(cors())` en `src/server.ts`), sin restricción de orígenes.
*   **TODO abierto:** `src/services/grade.service.ts` indica que falta validar que el docente autenticado tenga asignada la materia (integración con login pendiente).
*   **Forma de errores:** `src/middlewares/errorHandler.ts` responde `{ error, details }`, excepto rutas de asistencia que responden `{ message }`. Unificar antes de implementar el contrato de auth (401 vs 403).
*   **Archivos de Referencia:**
    *   `src/server.ts`: middlewares globales, montaje de `/api`, `errorHandler` al final.
    *   `src/routes/index.ts`: registro de routers (sin auth).
    *   `prisma/schema.prisma`: modelo `User` con `passwordHash`, enum `Role` (6 roles) y `UserStatus` ya definidos; base lista para auth real.

## 2. Implicaciones para el Desarrollo

*   **El backend es la única capa de seguridad confiable:** los guards del frontend son UX, nunca sustituyen la validación aquí.
*   **Datos sensibles:** la API expone PII de estudiantes (DNI, domicilio, tutores), calificaciones y asistencias sin credencial. No exponer en entornos compartidos hasta cerrar P0.
*   **Hoja de Ruta Futura:** endpoint `POST /api/auth/login`, middleware JWT/Bearer o cookie httpOnly, autorización por rol, CORS restringido por entorno y forma de error única.

## 3. Recomendaciones

*   Cualquier cambio de acceso debe coordinarse con el frontend (`edu-track-front/SECURITY_GUIDE.md` y `docs/security-architecture`).
*   No introducir tokens en `localStorage` sin revisión XSS/almacenamiento (preferir cookie httpOnly).

## 4. Dependencias (actualizado 2026-09-30)

*   **Auditoría:** `npm audit` reportaba 3 vulnerabilidades (`qs` 2.2.5-6.15.3 moderate, `body-parser` 1.20.5-1.20.6 moderate vía `qs`, `esbuild` 0.27.3-0.28.0 low). Se aplicó `npm audit fix` (`qs` 6.15.3 => 6.16.0, `body-parser` 1.20.6 => 1.20.8, `esbuild` 0.27.7 => 0.27.2). Resultado: **0 vulnerabilidades**. Verificación: `npm run build` (tsup) OK.
*   **Política decidida (no freeze):** se mantienen rangos `^` en `package.json`; la reproducibilidad la garantiza `package-lock.json` commiteado. Instalar siempre con `npm ci`.
*   **Mantenimiento:** correr `npm audit` ante cada cambio de dependencias y `npm audit fix` para parches compatibles; los cambios de major se evalúan aparte.
