# Architecture

## 1. Shape of the system

Three containers, one network, no external runtime dependencies.

```
                  ┌─────────────────────────────────────────────┐
   Browser ─────▶ │ web — Next.js (App Router), :3000           │
                  │  /            Product Website (public)      │
                  │  /patient/*   Patient app                   │
                  │  /doctor/*    Doctor app                    │
                  │  /admin/*     Admin console                 │
                  └───────────────────┬─────────────────────────┘
                                      │ REST + JSON, Bearer JWT
                                      ▼
                  ┌─────────────────────────────────────────────┐
                  │ api — NestJS, :3001, prefix /api            │
                  │  auth · users · patients · doctors ·        │
                  │  availability · matching · appointments ·   │
                  │  consultations · records · notifications ·  │
                  │  admin · audit                              │
                  └───────────────────┬─────────────────────────┘
                                      │ Prisma Client
                                      ▼
                  ┌─────────────────────────────────────────────┐
                  │ db — PostgreSQL 16, :5432, named volume     │
                  └─────────────────────────────────────────────┘
```

The four product modules (Product Website, Patient, Doctor, Admin) are route groups
inside the single frontend container, not separate deployables. One frontend, one
backend, one database keeps the prototype coherent and the compose file honest.

## 2. Repository layout

pnpm workspace monorepo:

```
.
├─ apps/
│  ├─ web/                  Next.js App Router frontend
│  │  ├─ app/
│  │  │  ├─ (marketing)/    landing, terms, privacy
│  │  │  ├─ (auth)/         sign-in, register/patient, register/doctor
│  │  │  ├─ patient/        dashboard, doctors, match, appointments, records
│  │  │  ├─ doctor/         dashboard, schedule, appointments, patients
│  │  │  ├─ admin/          dashboard, users, doctors, appointments, audit
│  │  │  └─ consultation/[appointmentId]/   shared workspace
│  │  ├─ components/ui/     shadcn/ui primitives
│  │  ├─ components/        feature components
│  │  └─ lib/               api client, auth context, formatters
│  └─ api/                  NestJS backend
│     ├─ src/modules/       one folder per bounded concern
│     ├─ src/common/        guards, filters, interceptors, decorators
│     ├─ prisma/            schema.prisma, migrations/, seed.ts
│     └─ test/
├─ packages/
│  └─ shared/               TS types + zod schemas shared by web and api
├─ docs/
├─ docker-compose.yml
├─ TASKS.md
└─ pnpm-workspace.yaml
```

`packages/shared` is the contract: DTO shapes, enums, and error codes are declared
once and imported by both sides, so the API spec cannot silently drift from the UI.

## 3. Backend modules

| Module | Owns |
|---|---|
| `auth` | Registration, login, refresh, logout, password hashing, JWT issuance |
| `users` | Account records, status transitions (active / suspended / deactivated) |
| `patients` | Patient profile CRUD, medical-history fields |
| `doctors` | Doctor profile CRUD, specializations, public directory and search |
| `availability` | Recurring weekly rules, one-off blocks, derived bookable slots |
| `matching` | Deterministic symptom → specialty → doctor ranking |
| `appointments` | Book, reschedule, cancel; conflict and state rules |
| `consultations` | Session state machine, join, notes, prescriptions |
| `records` | Patient-facing history: appointments, notes, prescriptions |
| `notifications` | Write on domain events, list/mark-read for the recipient |
| `admin` | User management, doctor review, appointment oversight, dashboard counts |
| `audit` | Append-only log of admin actions |
| `health` | Liveness and database readiness |

Layering inside a module is strict: **controller** (HTTP, DTO validation) →
**service** (business rules, transactions) → **Prisma** (persistence). Controllers
never touch Prisma; services never read the request object.

## 4. Cross-cutting concerns

- **Global `ValidationPipe`** — `whitelist`, `forbidNonWhitelisted`, `transform`.
- **`JwtAuthGuard`** applied globally; public routes opt out with `@Public()`.
- **`RolesGuard`** with `@Roles(Role.DOCTOR)` etc. for coarse-grained access.
- **Ownership checks in services** for fine-grained access — the guard says "a doctor",
  the service says "*this* doctor, for *this* appointment". Both are required.
- **Global exception filter** producing the single error envelope in
  [API_SPEC.md](API_SPEC.md); unexpected errors are logged with a request id and
  returned as a generic `INTERNAL_ERROR`.
- **Request-id interceptor** — `x-request-id` echoed on every response and attached to
  every log line.
- **Audit interceptor** — admin-scoped mutations append an `AuditLog` row in the same
  transaction as the change, so the log cannot diverge from the data.

## 5. Authentication and session

1. Register or sign in → API verifies an argon2id password hash.
2. API returns a short-lived **access JWT** (15 min) in the response body and sets a
   long-lived **refresh token** as an `httpOnly`, `sameSite=lax` cookie (7 days).
3. The web app sends `Authorization: Bearer <access>` on each call and silently calls
   `POST /api/auth/refresh` on a `401 TOKEN_EXPIRED`, retrying the original request once.
4. Logout revokes the refresh token server-side (`RefreshToken.revokedAt`).

JWT payload: `{ sub: userId, role, status, jti, iat, exp }`. Every guard re-checks the
user's current status against the database on privileged routes, so a suspension takes
effect without waiting for token expiry.

## 6. Key domain flows

### 6.1 Availability → bookable slots

Doctors define `AvailabilityRule` rows (weekday, start, end, slot length) plus
`AvailabilityException` rows (a blocked date range). The API derives concrete slots on
read for a requested date window:

```
slots(doctor, from, to) =
    expand(rules, from..to, slotMinutes)
  − overlaps(exceptions)
  − overlaps(appointments where status in (PENDING, CONFIRMED))
  − slots starting before now + minimumLeadTime
```

Slots are computed, never stored. That keeps the schedule editable without a
migration-shaped backfill, and makes the conflict rule single-sourced.

### 6.2 Booking

Book, reschedule, and cancel all run in a single serializable transaction:

1. Re-derive the requested slot and assert it is still bookable.
2. Assert the patient has no other active appointment overlapping the window.
3. Insert or update the `Appointment`.
4. Insert the `ConsultationSession` in `SCHEDULED`.
5. Insert `Notification` rows for both parties.

A unique index on `(doctorId, startsAt)` for active appointments is the last line of
defence against a race that slips past the transaction.

### 6.3 Deterministic matching

No model call. The patient picks symptom tags (or types free text, which is matched
against tag synonyms by normalized substring — still deterministic, still local). Then:

```
score(doctor) = Σ over matched symptoms of  SymptomSpecialty.weight
              + availabilityBonus(next free slot within 48h)
              + experienceBonus(yearsOfExperience, capped)
```

Only `APPROVED`, active doctors are considered. Ties break on earliest next slot, then
doctor id, so results are stable and explainable — the API returns the matched
symptoms and contributing specialties alongside each suggestion, which is what makes
the feature defensible in review.

### 6.4 Consultation session state machine

```
SCHEDULED ──join(either party)──▶ JOINED ──both present / doctor starts──▶ IN_PROGRESS
                                                                              │
                                                       doctor completes ──────┘
                                                                              ▼
                                                                         COMPLETED
     any state before COMPLETED ──cancel(patient|doctor|admin)──▶ CANCELLED
     start time + grace elapsed, never joined ──────────────────▶ NO_SHOW
```

Transitions are validated in `ConsultationsService`; an invalid transition is a
`409 INVALID_STATE_TRANSITION`. Notes and prescriptions may only be written while
`IN_PROGRESS` or `COMPLETED`, and only by the appointment's doctor.

### 6.5 Notifications

Domain services emit through an in-process event emitter; the notifications module
subscribes and writes rows. The client polls `GET /api/notifications?unread=true`
every 30 seconds — simple, database-backed, and no external transport, which is
exactly what the standalone rule asks for.

## 7. Frontend architecture

- **Next.js App Router.** Marketing routes are static and server-rendered for a fast,
  crawlable landing page. Authenticated routes are client components behind a session
  provider, because they are personalized and interactive.
- **Route groups per role**, each with its own layout and navigation shell.
  `middleware.ts` redirects unauthenticated users to sign-in and wrong-role users to
  their own dashboard; the real enforcement still lives in the API.
- **Data fetching** via TanStack Query over a thin typed `apiClient` that owns base
  URL, auth header, refresh-on-401, and error-envelope unwrapping.
- **Forms** via React Hook Form + zod resolvers, with the zod schemas imported from
  `packages/shared` so client and server validate the same shape.
- **UI** from shadcn/ui on Tailwind; see [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md).

## 8. Decisions and trade-offs

| Decision | Why | Cost |
|---|---|---|
| Monorepo with shared types | One contract, no drift between web and api | Slightly heavier tooling setup |
| Derived slots, not stored slots | Single source of truth for conflicts | Recomputed per request; fine at prototype scale |
| Poll notifications | No transport dependency, trivially reliable | Up to 30s latency; WebSocket is the obvious upgrade |
| Access JWT + refresh cookie | Standard, self-hosted, survives reload | Must handle refresh races in the client |
| Rules-based matching | Explainable, offline, testable | Less flexible than semantic matching |
| Text consultation workspace | A/V explicitly not required | Not a real clinical encounter |

## 9. Known limitations

Single API instance assumed — the in-process event emitter and polling do not fan out
across replicas. No rate limiting beyond a global throttle on auth routes. No
soft-delete or record versioning on clinical data. Timezone handling assumes doctors
publish availability in a single clinic timezone stored on their profile.
