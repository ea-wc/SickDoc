---
description: "Use when writing or editing NestJS API code in apps/api — ESM .js imports, module/controller/service/dto layout, guards and decorators, AppException error envelope, Prisma serializable transactions, ownership checks, oxlint + vitest."
applyTo: "apps/api/**"
---

# SickDoc API Conventions

## Imports & TypeScript
- ESM `nodenext` — every relative import needs a `.js` extension. Missing extensions fail at **runtime**, not compile time.
- No path aliases. Use relative paths (`../common/...`) or workspace/package names (`@sickdoc/shared`, `@prisma/client`).
- Strict TS, but `strictPropertyInitialization: false` is deliberate — DTO fields use definite assignment (`field!: string`).
- Enums (`Role`, `AppointmentStatus`, `SessionStatus`, …) are imported from **`@prisma/client`** (not `@sickdoc/shared`); keep in sync with `packages/shared/src/enums.ts`.

## Module layout
- `*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/*.dto.ts`.
- Pure domain logic (slots, conflicts, state machine, timezone) lives in sibling files with co-located `.spec.ts`.
- Controllers never touch Prisma; services never read the request object. Ownership checks live in services.

## Guards & decorators (`src/common/`)
- Global `JwtAuthGuard` (opt out with `@Public()`), `RolesGuard` (`@Roles(Role.X)`), `@CurrentUser() user: AuthenticatedUser`.
- `JwtAuthGuard` re-reads the user row from the DB on **every** request — suspensions take effect immediately.
- Guard/filter/pipe registration order in `src/common/common.module.ts` matters; add new global providers there.

## Errors
- Throw `AppException(code, message, details)`; `code` from `ErrorCodes` in `@sickdoc/shared`.
- The global filter renders `{ error: { code, message, details, requestId, timestamp } }`.
- Unauthorized lookups throw `NOT_FOUND` (not `403`) to avoid leaking resource existence.

## Prisma
- `PrismaService` is `@Global` — no need to import `PrismaModule` per feature.
- Mutations like booking run in a **serializable** interactive transaction; catch `P2002` as `SLOT_UNAVAILABLE`.
- Admin mutations append an `AuditLog` row in the same transaction.

## Lint & tests
- Lint is **oxlint** (`pnpm --filter @sickdoc/api lint`); unit tests are **vitest**, co-located `*.spec.ts` (`pnpm --filter @sickdoc/api test`).

## Reference
- Canonical modules: `src/appointments/`, `src/consultations/`
- Contract & envelope: `docs/API_SPEC.md` · error codes: `packages/shared/src/errors.ts`
