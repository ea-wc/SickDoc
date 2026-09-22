---
description: "Use when writing or editing the Next.js web app in apps/web — client-components-only data fetching, TanStack Query via lib/api-client, auth context and middleware edge runtime, Tailwind v4 + shadcn/ui, React Hook Form + shared Zod schemas, Playwright e2e."
applyTo: "apps/web/**"
---

# SickDoc Web Conventions

## Rendering & data
- **Every feature page is `"use client"`** — no server-side data fetching. Load all data via TanStack Query through `lib/api-client.ts`.
- Only server components: root `layout.tsx`, root `page.tsx`, the three role `layout.tsx` (thin wrappers around `RoleShell`), and static pages.
- `lib/api-client.ts` is the single fetch entry point: base URL, bearer header, refresh-on-401, and error-envelope unwrapping (`ApiError` with `code`/`message`/`details`).

## Auth
- Access JWT lives in memory and is mirrored to a non-httpOnly `accessToken` cookie **only** so `middleware.ts` can route. The refresh token is an httpOnly cookie owned by the API. Real enforcement is server-side.
- `middleware.ts` runs on the **edge runtime** — `atob`/JSON only; no verified JWT, no Node APIs. Treat the cookie as a routing hint.

## UI
- Tailwind v4 — **no `tailwind.config.*`**; tokens live in `app/globals.css` (`@theme inline`). shadcn/ui "new-york" style, lucide icons.
- Add shadcn components with the CLI (`npx shadcn@latest add …`); aliases are in `components.json`.
- Shared helpers in `components/shared/` (e.g. `status-badge.tsx` maps domain status → badge).

## Forms
- React Hook Form + `zodResolver`; schemas imported from `@sickdoc/shared` (e.g. `loginSchema`, `registerPatientSchema`, `registerDoctorSchema`).

## Env & build
- Only one env var: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`). Secrets belong to the API only.
- `@sickdoc/shared` is CommonJS — keep it in `transpilePackages` (`next.config.ts`) and build it first (`pnpm build:shared`).
- `output: "standalone"` nests under `apps/web/` in this monorepo; Dockerfiles account for it.

## Tests
- Playwright e2e in `e2e/` — one spec per role + product website; reuse `e2e/helpers.ts` credentials and `signIn()`.
