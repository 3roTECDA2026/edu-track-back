# ⚡ ESLint y Prettier - Quick Start

## Instalación (ya hecha ✅)

Las dependencias ya están instaladas:
```bash
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier
```

## Comandos Esenciales

```bash
# Ver errores
npm run lint

# Arreglar automáticamente
npm run lint:fix

# Formatear código
npm run format

# Compilar proyecto
npm run build

# Correr en desarrollo
npm run dev
```

## Flujo Rápido Diario

### 1️⃣ Escribir código
```bash
npm run dev
# ... edita archivos ...
```

### 2️⃣ Guardar y automático en VS Code
- **Ctrl+S** → Prettier formatea automáticamente
- ESLint revisa en tiempo real

### 3️⃣ Antes de push
```bash
npm run lint:fix && npm run format && npm run build
```

## Errores Comunes

### ❌ Error: Cannot find module '@/utils/httpError'
**Solución:** Ctrl+Shift+P → "TypeScript: Reload Projects"

### ❌ Warning: Unexpected any type
**Solución:** Cambiar `any` por `unknown`
```typescript
// ❌ MAL
const x: any = 123;

// ✅ BIEN
const x: unknown = 123;
```

### ❌ Variable no usada
**Solución 1:** Remover la variable
```typescript
// ❌ MAL
const unused = 123;

// ✅ BIEN
// simplemente no declarar
```

**Solución 2:** Si es necesario, prefixar con `_`
```typescript
// ✅ BIEN - indica que es intencional
const _unused = 123;
function test(_param) {}
```

### ❌ Imports desordenados
**Solución:** Ejecutar `npm run lint:fix` (se arregla automáticamente)

```typescript
// ❌ MAL
import { HttpError } from '../utils/httpError';
import type { StudentInput } from '../schemas/student.schema';
import { prisma } from '../lib/prisma';
import { Router } from 'express';

// ✅ BIEN
import { Router } from 'express';

import { prisma } from '@/lib/prisma';
import type { StudentInput } from '@/schemas/student.schema';
import { HttpError } from '@/utils/httpError';
```

## Configuraciones en VS Code

Ya está pre-configurado en `.vscode/settings.json`:
- ✅ Format on save con Prettier
- ✅ ESLint auto-fix on save
- ✅ TypeScript workspace version

**Si no funciona:**
1. Asegúrate de tener ESLint y Prettier instalados como extensiones
2. Ctrl+Shift+P → "TypeScript: Select TypeScript Version" → "Use Workspace Version"

## Ignorar Reglas (si es necesario)

Para una línea específica:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = JSON.parse(str);
```

Para todo un archivo:
```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
// ... código ...
```

Para una regla específica:
```typescript
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = 123;
```

## Verificar antes de commit

```bash
#!/bin/bash
# Verificar lint
npm run lint || exit 1

# Verificar build
npm run build || exit 1

echo "✅ Todo bien, listo para push!"
```

Guarda como `.git-pre-commit.sh` y ejecuta antes de hacer push.
