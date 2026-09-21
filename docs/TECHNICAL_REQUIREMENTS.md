# Technical Requirements

Binding technical constraints for the telehealth prototype. These are not
preferences — a submission that violates one is out of adherence.

## 1. Platform

Web application, desktop-oriented, responsive down to mobile widths.

## 2. Stack

| Layer | Requirement |
|---|---|
| Frontend | Next.js (App Router) or React with Vite |
| Backend | NestJS |
| API | REST, JSON over HTTP/HTTPS, between frontend and backend |
| Language | TypeScript, frontend and backend |
| ORM | Prisma |
| Database | PostgreSQL |
| Package manager | pnpm |
| Version control | Git, hosted on GitHub / GitLab / Bitbucket or equivalent |

This project uses **Next.js (App Router)** for the frontend and a **pnpm workspace
monorepo**; see [ARCHITECTURE.md](ARCHITECTURE.md) for the layout.

## 3. Standalone runtime — the hard constraint

Every core feature must be implemented through the frontend application, the NestJS
backend, Prisma, and PostgreSQL. Open-source packages are allowed. SaaS, BaaS, and
external runtime APIs must **not** be used for:

- authentication
- doctor matching
- notifications
- messaging
- file storage
- scheduling
- conferencing
- medical records

Practical consequences:

| Temptation | Required instead |
|---|---|
| Auth0 / Clerk / Supabase Auth / Firebase | Own `AuthModule`: bcrypt/argon2 hash + JWT issued by the API |
| OpenAI / any LLM for symptom matching | Deterministic rules over a `SymptomSpecialty` table |
| SendGrid / Twilio / FCM | Rows in a `Notification` table, polled or streamed by the app |
| S3 / Cloudinary / Gravatar | Generated initials avatars rendered client-side |
| Google Calendar / Calendly | `AvailabilityRule` + `Appointment` tables with server-side conflict checks |
| Twilio Video / Daily / Agora | First-party consultation workspace with a state machine; A/V not required |
| Google Fonts / CDN assets at runtime | Fonts and assets bundled and self-hosted |
| Google Analytics / PostHog | None, or database-derived counts only |

A quick self-check before submission: with outbound internet blocked, the full core
journey must still work against `docker compose up`.

## 4. Code quality

- Modular structure — one NestJS module per bounded concern; no god services.
- Documented — README, these `/docs`, and doc comments on non-obvious logic.
- Error handling — typed exceptions, a global exception filter, a consistent error
  envelope (see [API_SPEC.md](API_SPEC.md)), and no leaked stack traces in responses.
- Validation — `class-validator` DTOs with a global `ValidationPipe`
  (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
- Typing — TypeScript `strict: true` in every package; no `any` in exported surfaces.
- Lint and format — ESLint + Prettier, enforced by `pnpm lint` and CI.
- Tests — unit tests for the booking-conflict and specialty-matching rules at minimum;
  they are the logic most likely to be probed in review.

## 5. Development-only AI tools

AI tooling may assist development but must **not** be integrated into, or called by,
the deployed application. Use one of:

- **Option 1 — Cursor**, via Cursor Router.
- **Option 2 — Claude**, with Opus 5 for planning and Sonnet 5 for implementation.

Participants must be able to explain the implementation and architecture they ship,
regardless of how much of it was AI-assisted.

## 6. Local deployment

Frontend, NestJS backend, and PostgreSQL run locally with Docker Compose.

- `docker compose up` brings up all three services.
- Postgres data persists in a named volume.
- The API container runs `prisma migrate deploy` and the seed on start.
- Configuration comes from environment variables with a committed `.env.example`.
- Health endpoints: `GET /api/health` on the API, Postgres `pg_isready`; the API
  container waits for a healthy database before migrating.

Required environment variables:

| Variable | Service | Purpose |
|---|---|---|
| `DATABASE_URL` | api | Postgres connection string |
| `JWT_SECRET` | api | Access/refresh token signing secret |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | api | Token lifetimes |
| `CORS_ORIGIN` | api | Allowed web origin |
| `PORT` | api | API listen port (default 3001) |
| `NEXT_PUBLIC_API_URL` | web | Base URL of the REST API |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | db | Database bootstrap |

No secret is committed. `.env.example` holds placeholders only.

## 7. Bonus cloud deployment

Optional deployment to Netlify, Fly.io, Railway, Vercel, or equivalent. The cloud
deployment must not introduce SaaS, BaaS, or external feature API dependencies — a
managed PostgreSQL instance is infrastructure and is acceptable; a managed auth or
notification product is not.

## 8. Deliverables

- Git repository containing the implementation.
- Docker Compose configuration and local setup instructions.
- Video recording, maximum 15 minutes: demo the application, explain the
  implementation, discuss technical limitations, challenges, and future improvements.
- Presentation deck: product overview, key features, value proposition.
