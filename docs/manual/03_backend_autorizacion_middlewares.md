# Autorización en Backend: Middlewares y Enrutamiento en Express

Este capítulo explica cómo proteger las rutas del servidor utilizando **Middlewares** encadenados en la capa de ruteo de Express.

---

## 🛠️ 1. Interceptores de Ruta (Middlewares)

Un **middleware** es una función que se ejecuta en el medio del ciclo de vida de una petición HTTP. Puede interceptar el request, modificarlo, validar permisos o rechazar la petición antes de que llegue al controlador final.

```text
[Cliente HTTP] ──(Petición con Bearer Token)──> [verifyToken] ──> [requireRole(1)] ──> [Controlador Final]
```

---

## 2. Paso a Paso: Implementación

### 1️⃣ Verificación de Firma (`verifyToken`)
Comprueba que el token sea auténtico, no haya expirado y extrae los datos del usuario:

```typescript
// src/middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.userId = decoded.usuario_id;
    req.userRole = decoded.rol_id;
    next(); // Pasa al siguiente middleware
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
```

### 2️⃣ Autorización por Rol (`requireRole`)
Verifica si el rol extraído en `verifyToken` coincide con el rol necesario para ejecutar la ruta:

```typescript
export const requireRole = (requiredRole: number) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (Number(req.userRole) !== requiredRole) {
      return res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
    }
    next(); // Pasa al controlador
  };
};
```

---

## 3. Declaración en la Capa de Ruteo (Router)

En lugar de poner condicionales dentro del controlador, declaramos las reglas directamente en la definición del router:

```typescript
// src/routes/moderacion.routes.ts
import { Router } from 'express';
import { verifyToken, requireRole } from '@/middleware/auth.middleware';
import moderationController from '@/controllers/moderation.controller';

const router = Router();

// Endpoint que requiere token válido Y rol de Administrador (ID 1)
router.post('/config', verifyToken, requireRole(1), moderationController.saveConfig);

export default router;
```
