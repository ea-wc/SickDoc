---
description: "Use when editing packages/shared — the @sickdoc/shared contract package. Types, enums, error codes, and Zod schemas shared by web and api. Ships CommonJS to dist/; must be built before either app compiles."
applyTo: "packages/shared/**"
---

# SickDoc Shared Package Conventions

## What lives here
- `src/enums.ts` — domain enums (`Role`, `UserStatus`, `DoctorStatus`, `AppointmentStatus`, `SessionStatus`, `CancelledBy`, `NotificationType`, `AuditAction`)
- `src/errors.ts` — `ErrorCodes` + `ERROR_STATUS` (the single error vocabulary from `docs/API_SPEC.md` §1)
- `src/schemas.ts` — Zod schemas + inferred input types (`loginSchema`, `registerPatientSchema`, `registerDoctorSchema`, `passwordSchema`, `emailSchema`, `dateOnlySchema`, `timestampSchema`)
- `src/types.ts` — cross-cutting wire types
- `src/index.ts` — barrel re-export of all of the above

## Rules
- This package is the **web↔api contract** — DTO shapes, enums, and error codes are declared once here and imported by both sides.
- **Plain TypeScript + `tsc`** — no bundler. `pnpm build:shared` compiles to `dist/` as **CommonJS** (`main: dist/index.js`, `types: dist/index.d.ts`). Only `dist/` is consumed.
- `@sickdoc/shared` must be built **before** web or api compile. Root `pnpm dev`/`build` run `build:shared` automatically; after changing this package, rebuild it before relying on the change from web/api.

## Keeping things in sync
- **Enums are duplicated** with the Prisma schema (`apps/api/prisma/schema.prisma` → `@prisma/client`). When you change an enum here, mirror it in Prisma and add a migration — see `docs/DATA_MODEL.md` §2.
- `ErrorCodes` keys drive the API's error envelope; `ERROR_STATUS` maps each code to its HTTP status (used by the global exception filter).
- Zod schemas are the shared validation contract. The API enforces the same shape via class-validator DTOs in `apps/api/src/**/dto/` — keep both consistent.
- New symbols must be re-exported from `src/index.ts` or consumers can't see them.

## Conventions
- Keep the package dependency-light (only `zod` at runtime).
- Prefer types inferred from schemas (`z.infer<typeof x>`) over hand-written duplicates.
- `emailSchema` lowercases via `.transform()`; `passwordSchema` enforces min 10 + one letter + one digit.
