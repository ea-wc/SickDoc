# SickDoc

**See the right doctor, faster.** SickDoc is a standalone telehealth prototype: patients find and book the right specialist, doctors manage availability and run consultations, and administrators oversee the platform — all without any external service dependency.

> ⚠️ **Fictional prototype.** SickDoc is a demonstration application with generated, placeholder data. It is not medical advice and must not be used for real healthcare.

---

## What it is

Four modules make up the product:

| Module | Audience | What it does |
|---|---|---|
| **Find & match** | Patients | Browse a searchable doctor directory and run a deterministic guided match — pick symptoms or describe them in free text and get ranked suggestions with an explicit *rationale*. |
| **Booking** | Patients & doctors | Availability is derived, never stored: weekly rules minus exceptions, existing appointments, and a 60-minute lead time. Booking runs in a serializable transaction so two patients can never take the same slot. |
| **Consultation workspace** | Patients & doctors | A shared `/consultation/[appointmentId]` screen with a strict session state machine (`SCHEDULED → JOINED → IN_PROGRESS → COMPLETED/NO_SHOW`) and doctor-side notes + prescriptions. |
| **Administration** | Admins | Database-derived dashboard counts, user management, doctor credential review, appointment oversight, and an append-only audit log. |

Everything runs on your own machine against your own PostgreSQL. There is no SaaS, BaaS, or external API for auth, matching, notifications, messaging, file storage, scheduling, conferencing, or records — and no AI tool is integrated into or called by the application.

---

## Stack

| Layer | Technology |
|---|---|
| Workspace | pnpm 12 monorepo (`apps/*`, `packages/*`) |
| Web | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query v5, React Hook Form + Zod, next-themes |
| API | NestJS 12 (strict TypeScript, ESM), argon2id, JWT + rotating refresh tokens, Swagger at `/api/docs` |
| Data | Prisma 6 + PostgreSQL 16, check constraints and partial unique indexes |
| Shared | `@sickdoc/shared` — cross-cutting types, enums, error codes, and Zod schemas |
| Quality | Vitest (unit tests for slot derivation, booking conflicts, matching scores, state machine), Playwright (end-to-end), oxlint, ESLint |

---

## Getting started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 12 (enable with `corepack enable`)
- PostgreSQL 16 running locally — or use the included Docker container

### 1. Configure the environment

```bash
cp .env.example .env
cp .env.example apps/api/.env   # local dev: DATABASE_URL points at localhost
```

Defaults are safe for local development. Generate a real `JWT_SECRET` before any non-local deployment.

### 2. Start the database

```bash
docker compose up -d db          # postgres:16-alpine with a healthcheck, or…
# …use an existing local PostgreSQL and set DATABASE_URL in apps/api/.env
```

### 3. Install, migrate, and seed

```bash
pnpm install
pnpm db:migrate                  # prisma migrate dev
pnpm db:seed                     # idempotent — safe to run twice
```

### 4. Run

```bash
pnpm dev                         # web on http://localhost:3000, api on http://localhost:3001
```

Other useful commands:

```bash
pnpm build                       # build shared → api → web
pnpm lint                        # oxlint + eslint + tsc
pnpm test                        # vitest (API unit tests)
pnpm test:e2e                    # Playwright end-to-end (builds, migrates, seeds, then runs)
```

`pnpm test:e2e` applies migrations, re-seeds the database, starts the compiled API and the production web build, and runs the Playwright suite in `apps/web/e2e/`. The specs are organised by the Product Requirements modules — Product Website, Patient, Doctor, and Admin — and require a reachable PostgreSQL database.

### Seed credentials

All credentials are placeholders, not secrets.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@sickdoc.dev` | `Admin12345` |
| Doctor (approved) | `dr.chen@sickdoc.dev` | `Password123` |
| Doctor (pending review) | `dr.doe@sickdoc.dev` | `Password123` |
| Patient | `ada@sickdoc.dev` | `Password123` |

More doctors use `dr.<lastname>@sickdoc.dev` and patients use `<firstname>@sickdoc.dev` — see `apps/api/prisma/seed.ts` for the full roster.

## Project structure

```
apps/
  web/            Next.js frontend (App Router, role-scoped routes under /patient, /doctor, /admin)
  api/            NestJS REST API (global /api prefix) + Prisma schema, migrations, seed
packages/
  shared/         Shared types, enums, error codes, Zod schemas
docs/             Requirements, architecture, data model, API spec, design guidelines
```

Full requirements, contracts, and conventions live in [`/docs`](docs/) — `TASKS.md` is the execution checklist.

---

## Notes

- **No external assets**: fonts are self-hosted via `next/font`; there are no CDN, font-host, image-host, analytics, or third-party requests at runtime.
- **Deterministic matching**: `score = Σ symptom→specialty weights + availability bonus + experience bonus`, tie-broken by earliest slot then id. Free-text matching is word-token exact/prefix matching.
- **Authorization**: a global JWT guard re-reads the user from the database on every request, so a suspended account is refused by the API itself — not just hidden in the UI.

## Licence

Proprietary prototype — not for production medical use.
