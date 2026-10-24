# CLAUDE.md — edu-track-back (Notar)

Guía para agentes de IA y desarrolladores que trabajan en este repositorio.
Resume cómo está armado el backend, sus convenciones y las reglas que no se pueden romper.

---

## 1. Qué es

API REST de **Notar**, sistema de gestión de trayectorias escolares de la Escuela Secundaria
del ISFDyT Nº 166 (Tandil), según la normativa de la Provincia de Buenos Aires
(Res. 1650/24 DGCyE). Lo desarrolla el equipo TECDA 3º. Licencia AGPL-3.0.
El frontend vive en otro repositorio (`edu-track-front`, React + Vite).

Funcionalidades principales: usuarios y roles, ciclos lectivos, cursos/divisiones y materias,
legajo de estudiantes y tutores, inscripciones e historial, asignación de materias a docentes,
asistencia diaria, notas (4 parciales), intensificaciones, RITE (estados, firma y copia fija)
y alertas/notificaciones de estudiantes.

## 2. Stack

| Componente | Tecnología |
| --- | --- |
| Runtime | Node.js 22, módulos ES (`"type": "module"`) |
| Framework | Express 4 |
| Lenguaje | TypeScript 5 (`strict: true`, `noUncheckedIndexedAccess`) |
| ORM | Prisma 6 (`@prisma/client` y `prisma`, misma versión) |
| Base de datos | PostgreSQL (local en desarrollo) |
| Validación | Zod 4 |
| Autenticación | JWT (`jsonwebtoken`) + `bcrypt` |
| Build | `tsup` (genera `dist/server.js`) |
| Dev | `tsx watch` |

## 3. Comandos

```bash
npm install                 # instalar dependencias
npm run dev                 # servidor con recarga en http://localhost:3000
npx tsc --noEmit            # verificación de tipos — correrlo antes de cada commit
npm run build               # compila a dist/ con tsup
npm start                   # ejecuta dist/server.js (producción)
npm run lint / lint:fix     # ESLint (ver nota en §12)
npm run format              # Prettier
npx prisma generate         # regenerar el cliente tras cambiar schema.prisma
npx prisma migrate deploy   # aplicar migraciones pendientes a tu base
npx prisma db seed          # cargar datos de desarrollo (prisma/seed.ts)
npx prisma studio           # UI de la base en http://localhost:5555
```

No hay tests automatizados (`npm test` corre `node --test` sin archivos). La verificación
mínima es `npx tsc --noEmit` y probar los endpoints afectados (Postman o `curl`) contra
el back local. `GET /health` responde `{ status: 'ok' }` si el servidor está levantado.

## 4. Variables de entorno

Se cargan desde `.env` (ignorado por git). La plantilla es `.env.example`.
**Nunca** commitear valores reales ni pegarlos en issues, PRs o logs.

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto 3000) |
| `DATABASE_URL` | `postgresql://postgres:<contraseña>@localhost:5432/edutrack_db?schema=public` |
| `JWT_SECRET` | Firma de los tokens. Si falta se usa `'clave_secreta_temporal'` (solo desarrollo) |

La instalación de PostgreSQL local está explicada en `instalacion .txt`.
Si PostgreSQL está instalado con **snap**, se entra con `psql -U postgres -h /tmp`
(no con `sudo -u postgres psql`).

## 5. Estructura

```
src/
  server.ts                        # Express: CORS, JSON, GET /health, rutas en /api, errorHandler
  routes/        *.routes.ts       # endpoints y middlewares; index.ts los monta bajo /api
  controllers/   *.controller.ts   # validan entrada con Zod y arman la respuesta HTTP
  services/      *.service.ts      # reglas de negocio, permisos y acceso a Prisma
  schemas/       *.schema.ts       # esquemas Zod y tipos inferidos (z.infer)
  middlewares/                     # auth.middleware, errorHandler, requireActiveCycle
  lib/prisma.ts                    # instancia única de PrismaClient (`prisma`)
  utils/                           # asyncHandler, HttpError, sendSuccess
prisma/
  schema.prisma                    # modelo de datos (fuente de verdad del cliente)
  migrations/                      # una carpeta por migración, cada una con migration.sql
  seed.ts                          # datos de desarrollo (idempotente, con upsert)
create-admin.ts                    # crea admin@escuela.com / 123456
docs/                              # manual y documentación
```

### Capas

`route → controller → service → prisma`

- **Rutas:** solo declaran el endpoint y los middlewares (`verifyToken`, `requireRole`...).
  Cada handler va envuelto en `asyncHandler` (Express 4 no captura errores async).
- **Controllers:** parsean `params`, `query` y `body` con el esquema Zod (`schema.parse(...)`)
  y devuelven la respuesta. No atrapan errores: los deja pasar al `errorHandler`.
- **Services:** reglas de negocio y consultas Prisma. Lanzan `HttpError(status, mensaje)`
  (`src/utils/httpError.ts`) para errores esperados.
- **Schemas:** un archivo por recurso, con los esquemas y sus tipos (`CreateXInput`, etc.).
- Importar siempre `prisma` desde `@/lib/prisma`; no crear otros `PrismaClient`.

Ejemplo de referencia: el módulo `student` (`routes` → `controllers` → `services` → `schemas`).
Hay módulos viejos (`auth`, `attendance`, `notification`) con la lógica dentro de la ruta.
Para código nuevo, seguir el patrón en capas.

## 6. Convenciones de código

- **Idioma:**
  - En **inglés**: variables, funciones, tipos, archivos, modelos y columnas de Prisma,
    propiedades de la API (`listStudents`, `teacherAssignment.service.ts`, `ClassSection`).
  - En **español**: lo que ve la persona que usa la app, como los mensajes de `HttpError`
    (`'Usuario no encontrado'`). Hay mensajes viejos en inglés (`'Student not found'`):
    no hace falta migrarlos, pero los nuevos van en español.
  - Comentarios en el código: en español.
- **Archivos:** `recurso.capa.ts` (`grade.service.ts`, `rite.routes.ts`), en camelCase.
- **Imports internos** con el alias `@/` (→ `src/`), ordenados por grupos
  (builtin, external, `@/**`) separados por una línea en blanco.
- **Formato (Prettier):** sin punto y coma, comillas simples, `printWidth` 100,
  2 espacios, LF. Correr `npm run format` en los archivos tocados.
- **Errores:** lanzar `HttpError`; el `errorHandler` responde
  `{ success: false, error: 'mensaje', details? }`:
  - `ZodError` → 400 (`details` con los campos inválidos)
  - `HttpError` → su status (400 entrada inválida, 401 sin autenticación, 403 sin permiso,
    404 no existe, 409 conflicto/duplicado)
  - Prisma `P2002` → 409, `P2003` → 409, `P2025` → 404
  - cualquier otro → 500
- **Respuestas de éxito:** `sendSuccess(res, data, mensaje, status)` devuelve
  `{ success, data, message }` (lo usa `user`). Otros módulos devuelven el objeto directo con
  `res.json(...)`: respetar el formato del módulo que se edita, porque el front depende de él.
- **IDs:** son UUID. Validarlos con **`z.guid()`**, no con `z.uuid()`: los IDs fijos del seed
  (`00000000-0000-0000-0000-000000000202`) no tienen versión válida y Zod 4 los rechaza con
  `z.uuid()`.
- **Enums de Prisma en Zod:** `z.enum(Role)`, `z.enum(StudentStatus)`, etc.
- **Paginación:** `page` y `limit` con `z.coerce.number()` y valores por defecto
  (ver `listStudentsQuerySchema`).
- **Comentarios:** explicar el porqué, no repetir el código.
- **Constantes con nombre** para valores de negocio (ej. `OPERATIONAL_STATUSES`).

### Eliminaciones

Toda eliminación se confirma con el usuario **antes** de llamar a la API: el front muestra un
modal de confirmación y recién ahí hace el `DELETE`. Del lado del back:

- Para personas (usuarios, estudiantes) **no se borra**: se cambia el estado
  (`PATCH /users/:id/suspend`, `PATCH /students/:id/deactivate`). Así se conserva el historial
  académico.
- Los `DELETE` físicos (`grades`, `teacher-assignments`, `courses/class-sections`,
  `courses/subjects`) validan que el registro exista (404) y los permisos.
- Si el registro está en uso (claves foráneas), responder **409 con un mensaje claro en
  español** desde el service. El genérico de `P2003` (`'Related resource not found'`) no le
  dice al usuario qué pasó.
- Si el borrado arrastra otros datos en cascada (`onDelete: Cascade`), dejarlo comentado en el
  código y avisarlo en el PR.
- No exponer endpoints que borren en lote sin un filtro explícito.

## 7. Autenticación y roles

- Login: `POST /api/auth/login` con `{ user, password }`, donde `user` es el **email**.
  Devuelve `{ token, user }`. El token dura 24 h y su payload es `{ userId, role, name }`.
- El token se manda como `Authorization: Bearer <token>`.
- Middlewares en `src/middlewares/auth.middleware.ts`:
  - `verifyToken`: exige token, valida el payload y **toma el rol y el estado desde la base**
    (un usuario `SUSPENDED` o `INACTIVE` recibe 401). Completa `req.user`.
  - `requireRole(Role.ADMINISTRATOR, ...)`: 403 si el rol no está permitido. Va siempre
    después de `verifyToken`.
  - `getAuthUser(req)`: devuelve `req.user` o lanza 401.
- `requireActiveCycle` (`src/middlewares/requireActiveCycle.ts`): 409 si no hay ciclo lectivo
  activo; deja el ciclo en `req.activeCycle`.
- El rol es el **enum de Prisma `Role`**: `ADMINISTRATOR | SCHOOL_MANAGEMENT | EOE_DIRECTIVE |
  TEACHER | PRECEPTOR | STUDENT | FAMILY`. `PRECEPTOR` solo existe en el enum: ninguna ruta lo
  usa todavía en `requireRole`, así que un preceptor puede iniciar sesión pero no accede a
  nada protegido hasta que se lo agregue donde corresponda.
  - ✅ `req.user.role === Role.TEACHER`
  - ❌ `req.user.role === 'TEACHER'` o comparar con números
- La identidad sale **siempre del token** (`getAuthUser(req).userId`), nunca del body ni de la URL.
- Relaciones clave: `TeacherSubjectCourse` (docente ↔ materia ↔ curso),
  `EnrollmentHistory` (estudiante ↔ curso, con `startDate`/`endDate`), `StudentGuardian`
  (estudiante ↔ tutor), `ClassSection` pertenece a un `AcademicYear`.

## 8. Base de datos y migraciones ⚠️

Cada integrante trabaja con **su propia base PostgreSQL local** (la del `.env`).
Los cambios de esquema llegan a las bases de los demás **solo a través de las migraciones
incluidas en los PR**.

### Reglas

1. **Nunca** correr `prisma migrate reset` ni `prisma db push` contra una base con datos
   que quieras conservar. Si `prisma migrate dev` pide un reset ("Drift detected... All data
   will be lost"), responder **NO**: borra todos los datos de tu base.
2. **Todo cambio en `schema.prisma` lleva su migración** en el mismo PR. Sin migración,
   `migrate deploy` no crea la tabla o columna, el cliente la pide igual y las consultas fallan;
   y a cada compañero `migrate dev` le genera una migración distinta.
3. **No modificar una migración ya fusionada.** Prisma guarda su checksum; para corregir,
   crear una migración nueva.
4. Cada migración es una **carpeta** `AAAAMMDDHHMMSS_descripcion/` con un `migration.sql`
   adentro, con **fecha posterior a la última existente** (si no, el historial queda fuera de orden).
5. Preferir SQL idempotente cuando se escribe a mano:
   `ADD VALUE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
6. Si `migrate deploy` falla, **no** usar `prisma migrate resolve --applied` sin antes aplicar a
   mano lo que faltó: la marca como aplicada pero no la ejecuta.
7. Al agregar columnas `NOT NULL`, pensar qué valor deben tomar las filas existentes (default o
   un `UPDATE` en la misma migración; ver `backfill_notification_academic_year`).
8. `prisma/seed.ts` debe seguir siendo **idempotente** (`upsert` con IDs fijos) y funcionar en
   **Windows y Linux**. Para detectar si se ejecuta directo, usar
   `pathToFileURL(process.argv[1]).href`, no `` `file://${process.argv[1]}` `` (en Windows no
   coincide y `main()` nunca corre).

### Flujo para un cambio de esquema

```bash
# 1. Editar prisma/schema.prisma
# 2. Generar la migración sin aplicarla, para revisar el SQL
npx prisma migrate dev --create-only --name <descripcion>
# 3. Revisar prisma/migrations/<timestamp>_<descripcion>/migration.sql
# 4. Aplicarla, regenerar el cliente y verificar tipos
npx prisma migrate deploy
npx prisma generate && npx tsc --noEmit
# 5. Verificar
npx prisma migrate status   # "Database schema is up to date!"
```

Al traer cambios de otra rama: `npx prisma migrate deploy && npx prisma generate`.

### Usuarios para iniciar sesión

El seed de `develop-sprint3` crea un único usuario (`docente.prueba@notar.local`) con
`passwordHash: 'hash-de-prueba'`, que **no es un hash de bcrypt**: con ese usuario el login
siempre devuelve 401. Para tener un usuario que funcione en local:

```bash
npx tsx create-admin.ts     # crea admin@escuela.com / 123456 (ADMINISTRATOR)
```

El seed de `develop-sprint2` (PR #36, aún no está en `develop-sprint3`) crea 5 usuarios con
contraseñas bcrypt: `admin@notar.local` (`Admin1234!`), `direccion@notar.local`,
`eoe@notar.local`, `docente.prueba@notar.local` y `diego.suarez@notar.local`
(`Docente1234!`). Al unificar los seeds, los usuarios del seed deben usar `bcrypt.hash(...)`.

## 9. API

Base: `/api`. Recursos montados en `src/routes/index.ts`:

| Ruta | Recurso | Protección |
| --- | --- | --- |
| `/auth` | login | — |
| `/users` | CRUD de usuarios, `/:id/suspend`, `/:id/activate` | `ADMINISTRATOR` |
| `/students` | legajo, listado paginado con filtros, `/:id/deactivate`, `/:id/history` | ninguna |
| `/enrollments` | inscripciones | ninguna |
| `/class-sections` | listado de cursos/divisiones | ninguna |
| `/courses` | `/class-sections` y `/subjects` (CRUD) | ninguna |
| `/teacher-assignments` | asignación de materias a docentes | ninguna |
| `/grades` | notas, `/roster`, `/by-student` | ninguna |
| `/attendance` | asistencia, `/batch`, `/summary`, `/:id/justify` | ninguna |
| `/notifications` | alertas de estudiantes | ninguna |
| `/rites` | RITE: lectura libre, escritura con token, `close`/`reopen`/`sign` | directivos |

Las rutas nuevas deben usar `verifyToken` y, si corresponde, `requireRole`.
Las rutas fijas deben declararse **antes** que las paramétricas (`/roster` antes de `/:id`).
Montar cada router con su prefijo propio; no usar `router.use('/', ...)`, porque mezcla rutas
de distintos recursos y puede pisar otras.

CORS: `cors()` sin restricciones (acepta cualquier origen).

## 10. Git y Pull Requests

- Rama de integración del sprint: **`develop-sprintN`**. Las ramas salen de ahí y los PR van
  contra ella.
- Nombres de ramas: `feature/CRM-XXX-descripcion-en-kebab-case`, `fix/descripcion`,
  `docs/...`, `chore/...`. Si una rama depende de otra todavía sin mergear, crearla desde esa
  rama y avisarlo en el PR.
- Commits en español con formato *conventional commits*:
  `feat(area): ...`, `fix(area): ...`, `refactor(area): ...`, `chore: ...`,
  con el ticket si aplica (`(CRM-033)`).
- **No commitear** `dist/` ni `.env`. No incluir `package-lock.json` si la tarea no cambió
  dependencias.
- PRs mergeados con **"Create a merge commit"**.
- **Un PR = un objetivo.** No mezclar cambios ajenos al título (por ejemplo, tocar rutas en un
  PR del seed, o agregar modelos en un PR de roles).
- Antes de abrir el PR, actualizar la rama con `develop-sprintN` y resolver los conflictos
  conservando lo que ya está en la base (por ejemplo, routers montados por otros PR).
- La descripción del PR debe incluir: qué hace, archivos, cómo se probó, migraciones
  (y cómo aplicarlas) y qué tiene que hacer el equipo al traer los cambios.
- Si el cambio afecta al front (contrato de la API, nuevos permisos), coordinar el orden de merge.

## 11. Checklist antes de abrir un PR

- [ ] `npx tsc --noEmit` sin errores.
- [ ] Código nuevo en capas (route → controller → service), con `asyncHandler` y `HttpError`.
- [ ] Nombres en inglés; mensajes para el usuario en español.
- [ ] Entradas validadas con Zod; IDs con `z.guid()`.
- [ ] Si cambió `schema.prisma`: migración incluida, con fecha posterior a la última, y probada
      con `migrate deploy` sobre una base existente.
- [ ] Si cambió `seed.ts`: corre dos veces seguidas sin errores.
- [ ] Permisos validados en el back con `verifyToken` + `requireRole` (el front no reemplaza
      esa validación).
- [ ] Roles comparados con el enum `Role`; identidad tomada del token.
- [ ] Endpoints probados con los casos 400 / 401 / 403 / 404 / 409 relevantes.
- [ ] Los `DELETE` validan existencia y permisos y devuelven mensajes claros.
- [ ] Rama actualizada con `develop-sprintN` y sin cambios ajenos al título.
- [ ] Sin secretos, `console.log` de depuración ni archivos ajenos a la tarea.

## 12. Deuda técnica conocida

Al tocar estas zonas, seguir las convenciones de arriba en lugar de copiar lo existente:

- **`PasswordResetToken` no tiene migración.** El modelo entró en `schema.prisma` con el
  PR #40 (que solo debía agregar el rol `PRECEPTOR`), pero ninguna migración crea su tabla.
  Con `migrate deploy` la tabla no existe. Hay que crearla en una migración propia o sacar el
  modelo hasta que se use.
- La migración `20261009230000_add_preceptor_role` tiene una fecha anterior a
  `20261015232426_add_rite_snapshot`, que ya estaba aplicada. Funciona, pero queda fuera de orden.
- El seed de `develop-sprint3` no trae el arreglo de Windows (`pathToFileURL`) y solo crea un
  usuario con un hash falso. Los arreglos están en `develop-sprint2` (PR #36).

- `npm run lint` falla en todos los archivos: `.eslintrc.json` tiene en `parserOptions.project`
  y `settings` una ruta absoluta de otra máquina (`/home/lucas/...`). Debería ser
  `./tsconfig.json`.
- `auth.routes.ts` y `attendance.routes.ts` crean su propio `PrismaClient`; `auth`,
  `attendance` y `notification` tienen la lógica dentro de la ruta.
- `routes/index.ts` importa y monta el router de auth dos veces (`authRouter` y `authRoutes`).
- `academicYear.routes.ts` y `cycle.routes.ts` existen pero no están montados.
- Algunos esquemas todavía usan `z.uuid()` (`enrollment`, `grade`, `user`, partes de `student`
  y `rite`).
- La mayoría de los endpoints no exige autenticación.
- `JWT_SECRET` tiene un valor por defecto en el código; en producción debe definirse siempre.
- `src/services/api.ts` está vacío.
