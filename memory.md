# Deltra App API — Backend (`deltra-app-api`)

> Project memory / onboarding guide. The `README.md` is the NestJS boilerplate — **this** is the real guide.
> Snapshot: June 2026. Pairs with the frontend [`../deltra-app/memory.md`](../deltra-app/memory.md) and the session [`../HANDOFF.md`](../HANDOFF.md).

---

## 1. What this is

The backend for **Deltra School OS** — a **multi-tenant SaaS** for Indonesian schools and networks (yayasan). It is a **NestJS** REST API with **per-schema multi-tenancy** in a single PostgreSQL database, JWT auth (platform staff *and* per-tenant school users), background jobs (BullMQ/Redis), object storage (MinIO/S3), and document generation (Gotenberg + docxtemplater/pdfkit/exceljs).

Its own git repo (`.git/` present), separate from the frontend.

---

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | **NestJS 11** (`@nestjs/*` ^11) |
| ORM | **Prisma 6** (`prisma` / `@prisma/client` ^6.19) |
| DB | **PostgreSQL 16**, extensions `pgcrypto` + `citext` |
| Auth | Passport JWT (`passport-jwt`, `@nestjs/jwt`), bcrypt |
| Queue/jobs | **BullMQ** + **Redis** (`ioredis`), `@bull-board` dashboard |
| Storage | **MinIO / S3** via `@aws-sdk/client-s3` (+ presigner) |
| Email | `nodemailer` (sent through a BullMQ queue) |
| Docs/files | `docxtemplater` (+ image module, `pizzip`), `pdfkit`, `exceljs`, **Gotenberg** (HTTP) |
| Push | `firebase` / `firebase-admin` (FCM) |
| Validation/docs | `class-validator` + `class-transformer`, Swagger (`@nestjs/swagger`) |

---

## 3. Multi-tenancy — the most important concept

**Per-schema isolation inside one Postgres DB.**

- **`public` schema = platform layer.** Holds the tenant registry and SaaS-staff accounts. Prisma schema: `prisma/schema.prisma`. Default Prisma client.
- **`tenant_<slug>` schema = one school's data** (users, classrooms, attendance, …). Prisma schema: `prisma/tenant/schema.prisma`; generated client output → **`src/generated/tenant-client`**.
- **Schema name derivation:** `toSchemaName(slug) = "tenant_" + slug.replace(/-/g, "_")` (`src/tenant/tenant.utils.ts`). Example: slug `sma-test` → schema `tenant_sma_test`.

**Request flow** (`src/tenant/`):
1. `TenantMiddleware` resolves the tenant slug from (in order) the `x-tenant-slug` header → the JWT `tenantSlug` → the subdomain, looks it up in `public.tenants`, and stashes `{ tenantId, tenantSlug }` in an `AsyncLocalStorage` context (`tenant.context.ts`). 404 if unknown, 403 if suspended.
2. `PrismaTenantService` (`src/prisma/prisma-tenant.service.ts`) hands back a `PrismaClient` (from the generated tenant client) bound to that request's schema, via an LRU cache of clients (one per schema). Feature services use **this** client for tenant data — never the platform client.

**Provisioning a tenant** (`POST /tenants` → `TenantsService.create` → `TenantProvisionService.provision`, in `src/tenant/tenant-provision.service.ts`):
1. Insert the `Tenant` row in `public`.
2. `CREATE EXTENSION pgcrypto/citext`, `CREATE SCHEMA IF NOT EXISTS "tenant_<slug>"`.
3. `prisma migrate deploy --schema=prisma/tenant/schema.prisma` against that schema.
4. Create the initial `school_admin` user inside the new schema. Roll back on failure.
   - `migrateOne` / `migrateAll` re-apply pending tenant migrations (idempotent).

> Seeds only **upsert data**; they do **not** create schemas/tables and do **not** register the tenant in `public.tenants`. A schema must be migrated first, and registry rows come from the provisioning flow (or a manual insert).

---

## 4. Run

**Native (host), what the current `.env` is wired for:**
```bash
npm install
npm run start:dev        # nest watch; app listens on PORT (.env = 4000)
```
DB via `DATABASE_URL` (native Postgres on `localhost:5432`, db `deltra_dev`).

**Docker (full stack — Postgres, Redis, MinIO, Gotenberg, pgAdmin):**
```bash
docker compose up --build         # api published on host :4000 (container 4000)
docker compose exec api npx prisma migrate deploy      # platform tables
docker compose exec api npm run seed:platform          # superadmin
```
`docker compose` runs the **production** image target; `docker-compose.override.yml` bind-mounts `./prisma` and `./tsconfig.seed.json` so seeds/migrations use live files. Container startup CMD = `npm run db:bootstrap && node dist/main`.

Seed a tenant schema (migrate **then** seed):
```bash
docker compose exec -e DATABASE_URL='postgresql://postgres:postgres@postgres:5432/deltra_dev?schema=tenant_sma_test' \
  api npx prisma migrate deploy --schema=prisma/tenant/schema.prisma
docker compose exec -e SEED_DATABASE_URL='postgresql://postgres:postgres@postgres:5432/deltra_dev' -e SEED_SCHEMA='tenant_sma_test' \
  api npm run seed:tenant
```

Consoles: Swagger **`/api/docs`**, Bull dashboard **`/queues`**, MinIO `:9001`, pgAdmin `:5050`.

---

## 5. Directory map

```
src/
├── main.ts                 bootstrap: CORS, ValidationPipe, GlobalExceptionFilter, Swagger /api/docs
├── app.module.ts           imports every feature module; APP_GUARD = JwtAuthGuard; mounts TenantMiddleware
├── app.controller.ts       GET / and /health
├── auth/                   login/refresh/logout/forgot/reset/me, JWT strategy, DTOs
├── tenant/                 multi-tenancy core: context, middleware, utils, provision service
├── tenants/                platform tenant CRUD + provision + settings + migrate (+ resolve/validate-slug)
├── networks/               yayasan/foundation CRUD + member schools + network admins
├── users/                  tenant user CRUD
├── student-profiles/  teacher-profiles/   profile CRUD + photo upload + (students) guardians
├── student-portfolios/  student-achievements/  academic-notes/   records + file attachments
├── classrooms/  rooms/  schedules/  homeroom-assignments/  teacher-unavailability/   academic structure & timetabling
├── teacher-contracts/      contracts + templates, sign, preview/regenerate (PDF)
├── attendance/             record + homeroom/subject/parent/summary views
├── announcements/          CRUD + send + templates + recipients/read + delivery/audit logs
├── notifications/          in-app + FCM push; devices, events, fcm-config, test
├── prisma/                 PrismaService (public) + PrismaTenantService (per-schema)
├── queue/  redis/  mail/   BullMQ config, Redis service, mail queue + processor
├── storage/                MinIO/S3 upload/delete/read, presign
├── common/                 decorators (@Public, @CurrentUser, @RequireApiKey), guards (JwtAuthGuard, ApiKeyGuard), filters, enums, interfaces
└── generated/tenant-client/  auto-generated Prisma client for the tenant schema (do not edit)

prisma/
├── schema.prisma           PUBLIC/platform schema  (~10 migrations under migrations/)
├── migrations/
└── tenant/
    ├── schema.prisma        TENANT schema  (~31 migrations under tenant/migrations/)
    ├── migrations/
    ├── seed.ts              full demo dataset for one tenant schema
    ├── seed-schools.ts      seeds demo schemas tenant_school_1 / tenant_school_2
    └── seed-url.ts          builds tenant DB URL; rewrites host postgres→localhost for host runs

scripts/  bootstrap-db.js (run migrations on container start), create-superadmin.sql, test-provision.ts
docs/     currently EMPTY (see §11)
test/     e2e harness
```

---

## 6. Bootstrap (`src/main.ts`, `src/app.module.ts`)

- **Port:** `process.env.PORT ?? 3000` (real `.env` = **4000**).
- **CORS:** `enableCors({ origin: CORS_ORIGIN?.split(',') ?? true, credentials: true })` — **enabled** (was a HANDOFF open item, now done).
- **Body limit:** `BODY_LIMIT ?? '20mb'` (json + urlencoded).
- **Global ValidationPipe:** `{ whitelist, forbidNonWhitelisted, transform }`.
- **Global filter:** `GlobalExceptionFilter` (`src/common/filters/tenant-exception.filter.ts`).
- **Swagger:** `/api/docs`, bearer auth, persisted authorization.
- **Global guard:** `JwtAuthGuard` via `APP_GUARD` — every route requires a JWT unless marked `@Public()`.
- **`TenantMiddleware`** is applied to all routes **except** the public ones: `GET /`, `/health`, `POST /auth/login|forgot-password|reset-password`, `/api/docs/*`, and the `tenants/*` and `networks/*` route groups (platform-level, no single-tenant context).

---

## 7. Auth & authorization (`src/auth/`, `src/common/`)

- **Two login paths** in `auth.service.ts`: no `tenantSlug` → look up `public.platform_users` (SaaS staff/superadmin/network admin); with `tenantSlug` → look up the user inside that tenant's schema.
- **JWT payload:** `{ sub(userId), tenantId, tenantSlug, isSuperAdmin, isPlatformUser, role, networkId }`. `JwtStrategy` validates and attaches the user to the request.
- **Passwords:** bcrypt.
- **Refresh tokens** are stored in **Redis** (rotation on refresh). **Forgot-password OTP** also lives in Redis (~10 min TTL) and is emailed via the mail queue.
- **Decorators** (`src/common/decorators/`): `@Public()` (skip JWT), `@CurrentUser()` (inject request user), `@RequireApiKey()` (mark service-to-service routes).
- **Guards** (`src/common/guards/`):
  - `JwtAuthGuard` — global; honors `@Public()`.
  - `ApiKeyGuard` — checks `x-api-key` against `API_KEY`. **Now wired** (was a HANDOFF open item) on `GET /tenants/validate-slug` and `GET /tenants/resolve/:slug`, which combine `@Public() @RequireApiKey() @UseGuards(ApiKeyGuard)`. The guard short-circuits only when `isPublic && !requireApiKey`, so the combo correctly still enforces the key.

---

## 8. HTTP endpoints (by controller)

> Global JWT applies unless noted. `@Public` = no JWT; `apiKey` = requires `x-api-key`.

**Auth** — `POST /auth/login` *(public)*, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password` *(public)*, `POST /auth/reset-password` *(public)*, `GET /auth/me`.

**Tenants** *(platform; excluded from tenant middleware)* — `GET /tenants/validate-slug` *(public+apiKey)*, `GET /tenants/resolve/:slug` *(public+apiKey)*, `GET /tenants`, `GET /tenants/:id`, `POST /tenants` (create + provision), `PATCH /tenants/:id`, `DELETE /tenants/:id`, `POST /tenants/migrate-all` *(public)*, `POST /tenants/:id/migrate`, `GET|PUT|DELETE /tenants/:id/settings`.

**Networks (yayasan)** — `GET|POST /networks`, `GET /networks/:id`, `GET /networks/:id/schools`, `PATCH|DELETE /networks/:id`, `GET|POST /networks/:id/admin-users`, `DELETE /networks/:id/admin-users/:userId`.

**Users** — `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`.

**Student profiles** — `GET /student-profiles`, `…/user/:userId`, `…/:id`, `POST`, `PATCH /:id`, `POST /:id/photo` (≤5 MB), `DELETE /:id`, plus guardians `POST /:id/guardians`, `PATCH /:id/guardians/:gid`, `DELETE /:id/guardians/:gid`.

**Teacher profiles** — `GET /teacher-profiles`, `…/user/:userId`, `…/:id`, `POST`, `PATCH /:id`, `POST /:id/photo` (≤5 MB), `DELETE /:id`.

**Student portfolios** — `GET /student-portfolios`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/attachments`, `DELETE /:id/attachments/:aid`.

**Student achievements** — `GET /student-achievements`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/attachments` (≤10 MB, img/PDF), `DELETE /:id/attachments/:aid`.

**Academic notes** — `GET /academic-notes`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/attachments`, `DELETE /:id/attachments/:aid`.

**Classrooms** — `GET /classrooms`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`. **Rooms** — `GET|POST /rooms`, `PATCH|DELETE /rooms/:id`.

**Schedules** — `GET /schedules` (+ `by-class/:id`, `by-teacher/:id`, `by-student/:id`), `GET /:id`, `POST`, `PATCH /:id`, `PATCH /:id/publish`, `PATCH /:id/archive`, entries `POST /:id/entries` `PATCH|DELETE /:id/entries/:eid`, period templates `GET|POST /schedules/period-templates`, `PATCH …/:id`, rows `POST …/:tid/rows`, `PATCH /schedules/period-rows/:id`, `DELETE …`.

**Homeroom assignments** — `GET|POST /homeroom-assignments`, `PATCH|DELETE /:id`. **Teacher unavailability** — `GET|POST /teacher-unavailability`, `PATCH|DELETE /:id`.

**Teacher contracts** — `GET /teacher-contracts`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/sign`, `GET /:id/preview`, `POST /:id/regenerate`.

**Attendance** — `POST /attendance`, `GET /attendance/homeroom`, `GET /attendance/subject`, `GET /attendance/summary/grades`, `GET /attendance/parent`, `GET /student/attendance/:studentId`.

**Announcements** — `GET /announcements`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/send`, `POST /announcements/send-due`, `PATCH /:id/pin`, `PATCH /:id/unpin`, `PATCH /:id/recipients/:rid/read`, `GET /:id/delivery-logs`, `GET /:id/audit-logs`, templates `GET|POST /announcements/templates`, `PATCH|DELETE /announcements/templates/:id`.

**Notifications** — `GET /notifications/fcm-config`, `GET /notifications`, `PATCH /:id/read`, devices `GET|POST /notifications/devices`, `DELETE /notifications/devices/:id`, `POST /notifications/test`.

---

## 9. Prisma schemas

**`prisma/schema.prisma` (public):** `Tenant` (id, name, slug unique, type `school|network`, parentId, status, settings, features), `TenantSettings` (branding + academic config), `TenantFeature` (feature flags), `PlatformUser` (email citext, role `superadmin|staff|network_admin`, networkId, status), `FoundationPolicyTemplate`, `FoundationAuditLog`.

**`prisma/tenant/schema.prisma` (per school):** `User` (role `school_admin|network_admin|principal|finance|teacher|student|parent|admission`), `StudentProfile` (NISN/NIK, status), `Guardian`, `TeacherProfile` (NUPTK, employmentStatus `pns|p3k|tetap|honorer`), `Classroom`, `Subject`, `ClassSubject`, `Enrollment`, `AcademicYear`, `Room`, `PeriodTemplate`/`PeriodRow`, `Schedule`/`ScheduleEntry`/`ScheduleRequirement`, `HomeroomAssignment`, `TeacherUnavailability`, `StudentPortfolio`/`PortfolioAttachment`, `StudentAchievement`/`AchievementAttachment`, `AcademicNote`, `AttendanceRecord` (status `present|late|excused|sick|absent`), `TeacherContract`/`TeacherContractTemplate`, `Announcement`/`AnnouncementRecipient`/`AnnouncementDeliveryLog`/`AnnouncementTemplate`/`AnnouncementAuditLog`, `PushDeviceToken`/`NotificationEvent`/`NotificationRecipient`/`NotificationDeliveryLog`.

**Generators / engine:** public client → default `.prisma/client`; tenant client → **`src/generated/tenant-client`**. Extensions `pgcrypto`, `citext`. `binaryTargets` include `native` + `linux-musl-openssl-3.0.x` (+ arm64) so the Alpine container engine matches. Models use **soft deletes** (`deletedAt`), snake_case columns (`@map`), enums mapped to snake_case.

---

## 10. Seeds, queue, storage, documents

- **Seeds:** `npm run seed:platform` (one superadmin in `public`; envs `SUPERADMIN_EMAIL/USERNAME/PASSWORD/FULLNAME`, default `superadmin@deltra.id` / `superadmin123`). `npm run seed:tenant` (full demo dataset — academic year, classrooms, subjects, rooms, teachers, students+guardians, portfolios, achievements, schedules; targets `SEED_SCHEMA`, uses `SEED_DATABASE_URL` to bypass the host rewrite). `npm run seed:tenant:schools` (demo schemas `tenant_school_1` / `tenant_school_2`).
- **Queue:** BullMQ on Redis; mail queue (`mail` / `send-mail` job) with a processor in `src/mail/processors/`; notification delivery processors under `src/notifications/processors/`. Bull dashboard at `/queues`.
- **Storage:** `StorageService` (`src/storage/`) talks to MinIO/S3 via `@aws-sdk`. Keys are `<tenantSlug>/<folder>/<uuid>.<ext>`; creates the bucket and a public-read policy on init; returns a public URL. Used by photo/attachment/contract uploads.
- **Documents:** Gotenberg (HTTP, `GOTENBERG_URL`) + `docxtemplater`/`pdfkit`/`exceljs` for contract PDFs and exports.

---

## 11. Config, env & infra

**Env vars** (`.env.example`; real `.env` is gitignored — **do not commit secrets**): `PORT`, `NODE_ENV`, `API_KEY` (service-to-service; must equal frontend `DELTRA_API_KEY`), `DB_USER/DB_PASSWORD/DB_NAME/DB_PORT`, `DATABASE_URL` (schema=public), `JWT_SECRET`, `JWT_EXPIRES_IN`, `REDIS_HOST/REDIS_PORT`, `SMTP_*`, `MINIO_ENDPOINT/MINIO_PUBLIC_URL/MINIO_USER/MINIO_PASSWORD/MINIO_BUCKET`, `GOTENBERG_URL`, optional `CORS_ORIGIN`, `BODY_LIMIT`.

**Docker (`docker-compose.yml`):** services `api` (host `${PORT:-4000}` → container 4000), `postgres` (16-alpine, host `${DB_PORT:-5432}`), `pgadmin` (`:5050`), `redis` (7-alpine), `minio` (`:9000` API / `:9001` console), `gotenberg` (8; container 4000 published on host `:4001`). All on the `deltra-network` bridge. `Dockerfile` is multi-stage `node:24-alpine` (`development` / `builder` / `production`); production stage copies `dist`, `src/generated`, `node_modules/.prisma` (engine binaries) and keeps `typescript` for ts-node seeds.

`nest-cli.json` ships `src/generated/**` as assets. `tsconfig.seed.json` is the ts-node config for seeds. `scripts/bootstrap-db.js` runs platform + template-tenant migrations on container start.

---

## 12. Not built yet / scope notes

- **Finance / billing / invoices and grading/report-card (rapor)** have **no backend module** — those are **frontend-only prototypes** in `deltra-app`. (A DDD design for grading/rapor was referenced in HANDOFF but `docs/` is **currently empty**.)
- Auto-scheduler: data model (`ScheduleRequirement`, `TeacherUnavailability`) exists; solver maturity unverified.

---

## 13. Gotchas (read before debugging)

1. **`localhost` vs Docker service names.** Inside compose use `postgres`/`redis`/`minio`; natively use `localhost`. The current `.env` is a **hybrid**: `DATABASE_URL` points at native `localhost:5432` (db `deltra_dev`) while `REDIS_HOST=redis` and `MINIO_ENDPOINT=minio:9000` are Docker service names — so it only fully works in one specific arrangement; reconcile these before a clean native or clean-Docker run. **`MINIO_PUBLIC_URL` should be browser-reachable** (`http://localhost:9000`); the current `.env` sets it to `minio:9000`, which breaks file URLs outside the compose network.
2. **Platform `DATABASE_URL` must use `schema=public`** — `citext`/`pgcrypto` live there and `platform_users.email` depends on `citext`.
3. **Tenant client location/engine.** Generated to `src/generated/tenant-client`; the engine must match the runtime OS (`linux-musl-openssl-3.0.x` on Alpine). Regenerate both clients when schemas change.
4. **P3015 empty migration:** a cancelled `prisma migrate dev` leaves an empty migration folder that breaks all migrations — delete the empty dir.
5. **P2021 (table doesn't exist):** seeds only upsert — **migrate the tenant schema first**.
6. **Tenants aren't auto-registered** by seeds — registry rows in `public.tenants` come from `POST /tenants` (provisioning) or a manual insert.
7. **Port clash:** a native Windows Postgres may own `localhost:5432`; the HANDOFF setup published the Docker Postgres on **5433** to avoid it. Check which Postgres you're actually hitting.
8. **Alpine + Prisma openssl:** if `node:24-alpine` throws `libssl.so.3`, add `RUN apk add --no-cache openssl` or switch to `node:24-slim`.

More infra/WSL detail and dev credentials: [`../HANDOFF.md`](../HANDOFF.md).

---

## 14. Conventions

DTOs with `class-validator` (+ global whitelist/transform); Swagger decorators on every route (`@ApiTags/@ApiOperation/@ApiQuery/@ApiBearerAuth`); soft deletes via `deletedAt`; pagination `{ page, limit }` → `{ data, total, page, limit, … }`; one module per feature (`controller.ts`, `service.ts`, `module.ts`, `dto/`); tenant data **always** through `PrismaTenantService`, platform data through `PrismaService`.

---

## 15. See also

- Frontend guide: [`../deltra-app/memory.md`](../deltra-app/memory.md)
- Session handoff: [`../HANDOFF.md`](../HANDOFF.md)
- RBAC reference: `Deltra_RBAC_Reference.docx` · workflow notes: `workflow-api.md`
