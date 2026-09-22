---
name: playwright-e2e
description: 'Write or run Playwright end-to-end tests for the SickDoc web app in apps/web/e2e. Use when adding role-scoped specs (admin, doctor, patient) or product-website tests — reuses seeded credentials and the signIn() helper from e2e/helpers.ts, follows global-setup, and runs via pnpm test:e2e.'
---

# SickDoc Playwright E2E

## When to Use
- Adding or updating an end-to-end spec under `apps/web/e2e/`
- Debugging a failing e2e run

## Conventions
- One spec per role: `admin.spec.ts`, `doctor.spec.ts`, `patient.spec.ts`, plus `product-website.spec.ts`.
- Tests run against the **seeded database** (deterministic dataset). Do **not** rename seed users/emails without updating `e2e/helpers.ts`.
- `playwright.config.ts`: chromium only, `workers: 1`, `fullyParallel: false`, `baseURL http://localhost:3000`, trace/screenshot on failure, timeout 45s.
- `e2e/global-setup.ts` runs `prisma:deploy` + `db:seed` before servers start, so each run starts from a known state.

## Seeded credentials (`e2e/helpers.ts`)
| Export | Email | Password | Home |
|---|---|---|---|
| `PATIENT` | `ada@sickdoc.dev` | `Password123` | `/patient` |
| `DOCTOR` | `dr.chen@sickdoc.dev` | `Password123` | `/doctor` |
| `ADMIN` | `admin@sickdoc.dev` | `Admin12345` | `/admin` |

`helpers.ts` also exports `WEEKDAYS`, `MONTHS`, and `ordinal(n)` for date-label assertions.

## Signing in
`signIn(page, creds)` fills the **real** login form and waits for the role home route.

```ts
import { test, expect } from "@playwright/test";
import { ADMIN, signIn } from "./helpers";

test("admin can view the audit log", async ({ page }) => {
  await signIn(page, ADMIN); // navigates to /sign-in, fills form, waits for /admin
  await expect(page.getByRole("heading", { name: /audit/i })).toBeVisible();
});
```

## Running
- Root (recommended): `pnpm test:e2e` — builds, migrates, re-seeds, starts compiled servers, runs Playwright.
- Single spec against running servers: `pnpm --filter @sickdoc/web test:e2e -- e2e/admin.spec.ts`
