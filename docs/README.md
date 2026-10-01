# 📖 Documentación - edu-track-back

Bienvenido a la documentación del proyecto edu-track-back. Aquí encontrarás guías sobre desarrollo, configuración y mejores prácticas.

## 📚 Documentos Disponibles

### 🎨 Linting y Formato de Código

- **[ESLint y Prettier - Quick Start](./ESLINT_PRETTIER_QUICKSTART.md)** ⚡
  - Comandos esenciales
  - Flujo de trabajo diario
  - Errores comunes y soluciones rápidas
  - Configuración en VS Code

## 🚀 Inicio Rápido

### Instalación
```bash
cd edu-track-back
npm install
```

### Desarrollo
```bash
npm run dev    # Inicia el servidor
npm run lint   # Verifica errores
npm run build  # Build producción
```

### Antes de Push
```bash
npm run lint:fix && npm run format && npm run build
```

## 📋 Estructura del Proyecto

```
edu-track-back/
├── docs/                 # Documentación
│   └── ESLINT_PRETTIER_QUICKSTART.md
├── src/
│   ├── controllers/      # Controllers Express
│   ├── services/         # Lógica de negocio
│   ├── routes/           # Rutas Express
│   ├── schemas/          # Schemas Zod
│   ├── lib/              # Librerías (Prisma)
│   ├── middlewares/      # Middlewares Express
│   └── utils/            # Utilidades
├── prisma/               # Configuración Prisma
├── .eslintrc.json        # Configuración ESLint
├── .prettierrc.json      # Configuración Prettier
├── tsconfig.json         # Configuración TypeScript
└── package.json
```

## 🔨 Scripts Disponibles

| Script | Descripción |
|--------|------------|
| `npm run dev` | Inicia servidor en desarrollo |
| `npm run build` | Build para producción |
| `npm run start` | Inicia servidor compilado |
| `npm run lint` | Verifica errores ESLint |
| `npm run lint:fix` | Arregla errores ESLint automáticamente |
| `npm run format` | Formatea código con Prettier |
| `npm run format:check` | Verifica formato sin cambiar |
| `npm run test` | Ejecuta tests (node --test) |
| `npm run prisma:generate` | Genera Prisma Client |
| `npm run prisma:push` | Sincroniza schema con BD |
| `npm run prisma:studio` | Abre Prisma Studio |

## 🎯 Convenciones del Proyecto

### Imports

**Usar rutas absolutas con `@/`:**
```typescript
// ✅ BIEN
import { prisma } from '@/lib/prisma';
import type { UserInput } from '@/schemas/user.schema';
import { HttpError } from '@/utils/httpError';

// ❌ MAL
import { prisma } from '../../../lib/prisma';
import type { UserInput } from '../schemas/user.schema';
```

### TypeScript

**Evitar `any`:**
```typescript
// ✅ BIEN
const data: unknown = JSON.parse(str);

// ❌ MAL
const data: any = JSON.parse(str);
```

**Tipos implícitos:**
```typescript
// ✅ BIEN - Tipado explícito
const users: User[] = [];
function getUserById(id: string): Promise<User> {}

// ❌ MAL - Tipo implícito
const users = [];
function getUserById(id) {}
```

### Naming Conventions

- **Variables/Funciones:** camelCase
  ```typescript
  const userName = 'John';
  function getUserById() {}
  ```

- **Constantes:** UPPER_SNAKE_CASE
  ```typescript
  const MAX_RETRIES = 3;
  const DEFAULT_TIMEOUT = 5000;
  ```

- **Tipos/Interfaces:** PascalCase
  ```typescript
  interface UserInput {}
  type StudentStatus = 'ACTIVE' | 'INACTIVE';
  ```

- **Archivos:** camelCase con sufijo
  ```
  user.service.ts
  user.controller.ts
  user.schema.ts
  user.routes.ts
  ```

## 🔐 Calidad de Código

El proyecto incluye:

- ✅ **ESLint** - Linting y detección de errores
- ✅ **Prettier** - Formateo consistente
- ✅ **TypeScript** - Type safety
- ✅ **Zod** - Validación de schemas
- ✅ **Prisma** - Type-safe ORM

Ejecuta esto antes de cada push:
```bash
npm run lint:fix && npm run format && npm run build
```

## 🐛 Reportar Problemas

Si encuentras un problema:

1. Verifica que `npm run lint` no tiene errores
2. Verifica que `npm run build` compila correctamente
3. Recarga TypeScript en VS Code (Ctrl+Shift+P → "TypeScript: Reload Projects")
