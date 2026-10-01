# 3. Autorización por Ruteo (Routing-Based Authorization)

La **Autorización por Ruteo** consiste en declarar las reglas de acceso directamente en la capa de transporte/enrutamiento, impidiendo que peticiones no autorizadas lleguen a ejecutar la lógica interna del negocio.

---

## 🛠️ 1. Backend: Interceptores en Express (Middlewares)

En Express, encadenamos funciones intermedias en las declaraciones de las rutas:

```typescript
// src/routes/admin.routes.ts
import { Router } from 'express';
import { verifyToken, requireRole } from '@/middleware/auth.middleware';

const router = Router();

// Ruta pública (cualquiera entra)
router.get('/publico', publicController.getInfo);

// Ruta protegida por Ruteo:
// 1° Pasa por verifyToken (¿Tiene token válido?)
// 2° Pasa por requireRole(1) (¿Es Administrador?)
// 3° Si todo OK, ejecuta el controlador
router.post('/moderacion/config', verifyToken, requireRole(1), moderationController.saveConfig);
```

### Código de los Middlewares:
```typescript
// 1. Verificar firma del token
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
    req.userId = decoded.usuario_id;
    req.userRole = decoded.rol_id;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// 2. Control por Rol
export const requireRole = (requiredRole: number) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (Number(req.userRole) !== requiredRole) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
};
```

---

## 💻 2. Frontend: Enrutador Protegido en React

En React Router, envolvemos las rutas privadas en un componente declarativo:

```typescript
// src/components/ProtectedRoute.tsx
export const ProtectedRoute = ({ children, requiredRole }: { children: ReactNode, requiredRole?: number }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div>Cargando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.rol !== requiredRole) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
};

// Declaración en el AppRouter.tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  
  {/* Ruta administrativa protegida por Ruteo */}
  <Route 
    path="/admin" 
    element={
      <ProtectedRoute requiredRole={1}>
        <AdminDashboardPage />
      </ProtectedRoute>
    } 
  />
</Routes>
```
