# SickDoc — AI Agent Instructions

Standalone telehealth **prototype** with generated, placeholder data — fictional demo, not medical advice. pnpm monorepo:

- `apps/web` — Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, shadcn/ui, TanStack Query v5
- `apps/api` — NestJS 12 (strict TS, ESM), Prisma 6 + PostgreSQL 16, JWT + rotating refresh tokens
- `packages/shared` — `@sickdoc/shared`: shared types, enums, Zod schemas, error codes (the web↔api contract)
- `docs/` — authoritative requirements, architecture, data model, API spec, design guidelines

## Documentation map

- Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) · [docs/TECHNICAL_REQUIREMENTS.md](docs/TECHNICAL_REQUIREMENTS.md)
- System design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Schema: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- Endpoints & error envelope: [docs/API_SPEC.md](docs/API_SPEC.md)
- UI: [docs/DESIGN_GUIDELINES.md](docs/DESIGN_GUIDELINES.md)
- Setup, ports, seed credentials: [README.md](README.md) · execution checklist: [TASKS.md](TASKS.md)

Link to these instead of duplicating their content in your answers.

## Commands (run from repo root)

```bash
pnpm install
pnpm dev          # web :3000, api :3001 (builds shared first)
pnpm build        # shared → api → web
pnpm lint         # oxlint (api) + eslint (web) + tsc
pnpm test         # vitest (API unit tests)
pnpm test:e2e     # Playwright (builds, migrates, seeds, starts compiled servers)
pnpm db:migrate   # prisma migrate dev
pnpm db:seed      # idempotent — safe to run twice
```

Requires PostgreSQL 16 (`docker compose up -d db`), or a local Postgres with `DATABASE_URL` set in `apps/api/.env`.

## Hard rules & non-obvious conventions

### Workspace
- `@sickdoc/shared` must be built **before** web or api compile (`pnpm build:shared`); root `dev`/`build` do this automatically. It ships **CommonJS** to `dist/`.
- Domain enums/statuses are **duplicated** between `packages/shared/src/enums.ts` (web) and the Prisma-generated `@prisma/client` (api). Keep both in sync — see [docs/DATA_MODEL.md](docs/DATA_MODEL.md) §2.

### Per-area conventions (auto-applied when editing those files)
- **API** (`apps/api`): [.github/instructions/api.instructions.md](.github/instructions/api.instructions.md)
- **Web** (`apps/web`): [.github/instructions/web.instructions.md](.github/instructions/web.instructions.md)
- **Shared** (`packages/shared`): [.github/instructions/shared.instructions.md](.github/instructions/shared.instructions.md)
- Scaffolding skills: [nestjs-module](.github/skills/nestjs-module/SKILL.md) · [playwright-e2e](.github/skills/playwright-e2e/SKILL.md)

### Domain invariants (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))
- Availability slots are **derived, never stored**: rules − exceptions − active appointments − lead time.
- Booking/reschedule/cancel run in a serializable transaction; a unique index on active `(doctorId, startsAt)` is the last line of defence.
- Consultation session state machine: `SCHEDULED → JOINED → IN_PROGRESS → COMPLETED/NO_SHOW`; bad transitions throw `409 INVALID_STATE_TRANSITION`.
- Matching is deterministic (no model calls): weighted symptom→specialty + availability + experience bonuses, tie-broken by earliest slot then id.

## Testing
- API unit tests are co-located `*.spec.ts` (vitest); e2e at `apps/api/test/app.e2e-spec.ts`.
- Web e2e: Playwright in `apps/web/e2e/` — one spec per role (`admin`, `doctor`, `patient`) plus `product-website`. `e2e/helpers.ts` holds seeded credentials and a `signIn()` helper.
- `pnpm test:e2e` builds, migrates, re-seeds, then starts compiled servers. Do **not** rename seed users/emails without updating `apps/web/e2e/helpers.ts`.
