# Autorización en Frontend: Enrutamiento Protegido en React

Este capítulo explica cómo proteger las vistas en el cliente utilizando **React Router** y el patrón de componentes envoltorios (`ProtectedRoute`).

---

## 💻 1. ¿Por qué proteger rutas en el Frontend?

En una aplicación de página única (SPA) creada con React, la navegación se maneja en el navegador sin recargar la página.

- **Objetivo:** Evitar que un usuario no autenticado o sin los permisos adecuados pueda escribir manualmente una URL privada (ej. `/admin`) y ver la interfaz.
- **Nota clave:** La seguridad visual mejora la experiencia de usuario (UX), pero **nunca sustituye la validación del backend**.

---

## 2. Componente Envoltorio `ProtectedRoute`

Creamos un componente que intercepta el estado de sesión del contexto `AuthContext` antes de renderizar la página requerida:

```typescript
// src/components/ProtectedRoute.tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: number;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, user, loading } = useAuth();

  // 1. Si aún está verificando el token en localStorage, muestra cargando
  if (loading) return <div>Cargando...</div>;

  // 2. Si no está autenticado, lo redirige al Login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // 3. Si requiere un rol específico y el usuario no lo cumple, lo redirige
  if (requiredRole && user?.rol !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. Si cumple todas las condiciones, renderiza la vista
  return <>{children}</>;
};
```

---

## 3. Declaración en el Enrutador Principal (`AppRouter.tsx`)

Envolvemos las páginas privadas dentro del componente `ProtectedRoute` en la tabla de rutas:

```typescript
// src/routes/AppRouter.tsx
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import AdminPage from '@/pages/AdminPage';

export const AppRouter = () => (
  <Routes>
    {/* Ruta Pública */}
    <Route path="/login" element={<LoginPage />} />

    {/* Ruta Protegida: Usuario Autenticado */}
    <Route 
      path="/dashboard" 
      element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } 
    />

    {/* Ruta Protegida: Solo Administrador (Rol ID 1) */}
    <Route 
      path="/admin" 
      element={
        <ProtectedRoute requiredRole={1}>
          <AdminPage />
        </ProtectedRoute>
      } 
    />
  </Routes>
);
```
