# Secure the edu-track-back API Before Exposing Student Data

Backend serves student, attendance, grade, and enrollment records over unauthenticated Express routes. Every `/api/*` endpoint is reachable today, so auth, authorization, and hardening are the critical path before any production or pilot use.

## Quick path

1. Add authentication (login route + JWT/session middleware) and require it on all `/api/*` routes except `/health`.
2. Add role-based authorization using the existing `Role` enum; fix `attendance.routes.ts` to use the shared Prisma client and layered pattern.
3. Verify: unauthenticated `GET /api/students` returns 401; wrong-role `POST /api/attendance/batch` returns 403; `npm test` covers both.

## Details

### Architecture map

| Layer | Current state |
|-------|---------------|
| Entry | `src/server.ts`: Express + `cors()` (open) + `express.json()` + `/health` + `/api` + `errorHandler` last |
| Routing | `src/routes/index.ts` mounts `students`, `enrollments`, `grades`, `attendance`, `courseRouter`; no auth middleware anywhere |
| Pattern | Layered routes-controllers-services for students, grades, enrollments, courses, classSections |
| Exception | `src/routes/attendance.routes.ts` bypasses layers: own `new PrismaClient()`, inline Zod + business logic + responses |
| Data | `src/lib/prisma.ts` shared client; PostgreSQL via Prisma; rich domain schema (User, Student, Guardian, Grade, DailyAttendance, Rite, LegalConflict, AuditLog) |
| Validation | Zod schemas per domain (`src/schemas/*`); `loginSchema` exists in `auth.schema.ts` but has no route or consumer |
| Errors | `src/middlewares/errorHandler.ts` maps ZodError, HttpError, Prisma P2002/P2003/P2025; fallback 500 without leaking internals |
| Config | `dotenv`; `PORT` defaults to 3000; `DATABASE_URL` from env; `.env.example` documents expected vars |
| Quality | No tests, no linter, no CI (`npm test` runs bare `node --test` with zero test files) |

### Security posture

| Area | Status |
|------|--------|
| Authentication | Missing: no login/session/JWT route; `User.passwordHash` and `mfaEnabled` fields exist but are never exercised |
| Authorization | Missing: `Role` enum (ADMINISTRATOR, SCHOOL_MANAGEMENT, EOE_DIRECTIVE, TEACHER, STUDENT, FAMILY) defined but unenforced |
| Validation | Partial: Zod on most routes; attendance `batchSchema`/`paginationSchema` inline; ID params (`:id`) not validated as UUID |
| Data access | Risky: attendance creates its own Prisma client (connection-pool duplication); `GET /attendance` returns full `student` + `section` objects with no field filtering |
| Sensitive data | Exposed by design gap: DNI, addresses, guardians, grades, RITE/legal data reachable without auth; `AuditLog`/`SENSITIVE_VIEW` model exists but nothing writes to it |
| Transport/config | Weak: open CORS (`cors()` with no origin allowlist); no Helmet headers; no rate limiting; no request-size limit on `express.json()`; error paths use `console.error` only |
| Secrets | Acceptable pattern, unverified values: DB URL via env; no hardcoded secrets found in `src/` |

### Prioritized findings

**P0 — fix before any shared environment**

- [ ] P0-1: All `/api/*` routes unauthenticated — anyone can list, create, deactivate students and write attendance/grades.
- [ ] P0-2: No role checks — a STUDENT/FAMILY credential (once auth exists) could still call admin mutations.
- [ ] P0-3: Open CORS + no rate limit on auth-sensitive and batch-write endpoints (`/attendance/batch` upsert loop).

**P1 — fix before pilot with real data**

- [ ] P1-1: `attendance.routes.ts` owns a second `PrismaClient` and inline data access; inconsistent error shape (`{ message }` vs `{ error }`) breaks client handling.
- [ ] P1-2: Over-fetching: `include: { student: true, section: true }` returns full PII where a select would do; no pagination cap issue (capped) but `/summary` loads unbounded `findMany` then paginates in memory.
- [ ] P1-3: `registeredById` is client-supplied in batch body — caller can impersonate any registrar; must come from the authenticated session.
- [ ] P1-4: Missing audit writes for sensitive reads/writes despite `AuditLog` model and `ipAddress` requirement.

**P2 — harden soon after**

- [ ] P2-1: Add Helmet, CORS allowlist, body-size limit, rate limiting, UUID param validation, structured logging.
- [ ] P2-2: Add linter, test runner, and CI gate; cover auth, RBAC, and attendance batch paths first.
- [ ] P2-3: Review `recordNumber` generation loop for race safety under concurrency; confirm transaction isolation is sufficient.

## Checklist

- [ ] Reader can name which routes are public vs protected after the fix.
- [ ] Reader can trace a request: route -> controller -> service -> Prisma -> errorHandler.
- [ ] Reader knows why `attendance.routes.ts` is the highest-risk file to refactor.
- [ ] Reader can implement P0 items without guessing the intended auth model (JWT + Role).

## Next step

Implement P0-1 + P0-2 (auth middleware + role guard), then refactor `attendance.routes.ts` onto the shared client and layered pattern. Continue in `prisma/schema.prisma` (Role/User) and `src/routes/*` for enforcement points.

## Cross-repo integration notes (front)

- Frontend calls `VITE_API_URL || localhost:3000` with no auth header and its login page navigates locally without calling any API — backend must define the real contract: `POST /api/auth/login` request/response, token transport (Bearer header), 401/403 shapes matching `errorHandler` (`{ error, details }`), and CORS origins for the deployed frontend. See `edu-track-front/docs/SECURITY-ARCHITECTURE.md`.
