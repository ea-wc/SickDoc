# SickDoc Demo Flow

A guided walkthrough of the SickDoc **prototype** — a fictional telehealth demo, not medical advice.

## Prerequisites

- PostgreSQL 16 running (`docker compose up -d db`), or a local Postgres with `DATABASE_URL` set.
- From the repo root, `pnpm test:e2e:demo` builds `shared` → `api` → `web`, applies migrations, re-seeds, starts the compiled servers, and runs the Playwright suite in a **headed** browser with slow, narrated actions (mouse indicator on screen).

## Seed accounts

| Role    | Email                 | Password      | Home      |
| ------- | --------------------- | ------------- | --------- |
| Admin   | `admin@sickdoc.dev`   | `Admin12345`  | `/admin`  |

## Registration

Generate a short unique suffix `<sha>` for this run (e.g. `git rev-parse --short HEAD`). Use it in the names and emails below so each run registers fresh users.

| Role    | First name   | Last name | Email                          | Password      |
| ------- | ------------ | --------- | ------------------------------ | ------------- |
| Doctor  | `Doc <sha>`  | Doctor    | `demo.doctor.<sha>@gmail.com`  | `Password123` |
| Patient | `Pat <sha>`  | Patient   | `demo.patient.<sha>@gmail.com` | `Password123` |

## Demo steps

The demo tells one continuous story:

**Doctor registers → doctor sets their Monday–Friday schedule → admin approves → patient browses the product site → patient registers → patient finds & matches a doctor → patient books → doctor manages schedule & patients → admin oversees everything.**

### 1. Doctor registration
1. Open the product page at `/`.
2. Click **I'm a doctor** to open `/register/doctor`.
3. Fill in the professional profile — First name `Doc <sha>`, Last name `Doctor`, email `demo.doctor.<sha>@gmail.com`, password `Password123`, and a specialization (e.g. **Cardiology**).
4. Click **Create doctor account** to submit.
5. Verify the profile is still **pending** — awaiting admin review, not yet searchable.
6. Click **Dashboard** in the sidebar navigation to open the doctor dashboard (`/doctor`).

### 2. Doctor schedule setup (Monday–Friday)
1. Confirm you are on the doctor dashboard (`/doctor`).
2. Click **Schedule** in the sidebar to open `/doctor/schedule`.
3. Set the weekly availability for **Monday–Friday**.
4. Click **Save schedule**.
5. Sign out.
6. Confirm you are back on the product page (`/`).

### 3. Admin approval
1. Confirm you are back on the product page (`/`).
2. Click **Sign in** to open the sign-in page (`/sign-in`).
3. Sign in as **admin**.
4. Confirm you land on the admin dashboard (`/admin`).
5. Click **Doctor reviews** in the sidebar navigation to open `/admin/doctors`.
6. Find the newly registered doctor (`Doc <sha> Doctor`) in the pending list.
7. Click **Approve**.
8. Click **Confirm** in the dialog to submit the review.
9. Verify the doctor is now **approved** — active and bookable.
10. Sign out.
11. Confirm you are back on the product page (`/`).

### 4. Patient browses the product website
1. Confirm you are on the product page (`/`).
2. Review the landing page — value proposition, "How it works", and the fictional-prototype disclaimer.
3. Click **Terms** in the footer to open the terms page `/terms`.
4. Click **Privacy** in the footer to open the privacy page `/privacy`.
5. Click the **SickDoc** logo in the header to go back to the product page (`/`).
6. Confirm you are back on the product page (`/`).

### 5. Patient registration
1. Confirm you are back on the product page (`/`).
2. Click **Get started** to open `/register/patient`.
3. Fill in First name `Pat <sha>`, Last name `Patient`, email `demo.patient.<sha>@gmail.com`, password `Password123`, date of birth, and phone.
4. Click **Create account** to submit.
5. Confirm you land on the patient dashboard (`/patient`).
6. Open `/patient/profile`.
7. Update the profile — fill **Weight (kg)**, **Height (cm)**, and **Medical history**.
8. Click **Save changes** — confirm the profile is updated.
9. Click **Dashboard** in the sidebar navigation to open the patient dashboard (`/patient`).
10. Confirm you are on the patient dashboard (`/patient`).

### 6. Patient discovers a doctor
1. Confirm you are on the patient dashboard (`/patient`).
2. Click **Find a doctor** in the sidebar navigation to open `/patient/doctors`.
3. Search for the newly registered doctor (`Doc <sha>`).
4. Open `Doc <sha> Doctor` (Cardiology).
5. Confirm the profile shows **Available times** for the coming weekdays.

### 7. Guided matching
1. Click **Guided match** in the sidebar navigation to open `/patient/match`.
2. Type free-text symptoms (e.g. `"tight chest and shortness of breath"`).
3. Click **Get suggestions**.
4. Confirm the app maps symptoms to ranked specialties with a rationale and experience bonus.

### 8. Book a consultation
1. Click **Find a doctor** in the sidebar navigation to open `/patient/doctors`.
2. Search for `Doc <sha>` and open the newly registered doctor.
3. Pick a future weekday and an available time slot.
4. Enter a brief reason and click **Confirm booking**.
5. Confirm the appointment appears under `/patient/appointments`.
6. Open the patient dashboard (`/patient`) — confirm the **Appointment confirmed** notification.
7. Sign out.
8. Confirm you are back on the product page (`/`).

### 9. Doctor schedule & patients
1. Confirm you are back on the product page (`/`).
2. Click **Sign in** to open the sign-in page (`/sign-in`).
3. Sign in as the newly registered doctor (`demo.doctor.<sha>@gmail.com`).
4. Confirm you land on the doctor dashboard (`/doctor`).
5. Click **Schedule** in the sidebar to open `/doctor/schedule` — review weekly hours and blocked times, then **Save schedule**.
6. Open `/doctor/profile` to view specializations.
7. Open `/doctor/patients` to see the newly registered patient (`Pat <sha> Patient`).
8. Sign out.
9. Confirm you are back on the product page (`/`).

### 10. Admin oversight
1. Confirm you are back on the product page (`/`).
2. Click **Sign in** to open the sign-in page (`/sign-in`).
3. Sign in as the **admin**.
4. Confirm you land on the admin dashboard (`/admin`) — database-derived counts (users, doctors, pending reviews, audit entries).
5. Click **Appointments** in the sidebar to open `/admin/appointments` — every appointment with status filters.
6. Click **Audit log** in the sidebar to open `/admin/audit` — the append-only record of admin actions.
7. Sign out.
8. Confirm you are back on the product page (`/`).

## Test coverage

The full end-to-end demo is `demo.spec.ts` in this folder — a single, continuous journey through the steps above, run with `pnpm test:e2e:demo`. The per-role specs in `e2e/tests/` (`admin.spec.ts`, `doctor.spec.ts`, `patient.spec.ts`, `product-website.spec.ts`) cover the same screens in isolation for `pnpm test:e2e`. The mouse indicator and the slow `beat()` / `visible()` / `typeInto()` helpers live in `e2e/fixtures.ts` and `e2e/helpers.ts`.

## Requirement coverage

Checklist against `INITIAL_DOC.md` §2 (core user journey) and §5 (module requirements). Unchecked items are intentionally deferred — implement them one by one and tick them off here.

### Covered

- **Product website** — landing value prop + "How it works" (step 4); CTAs for patient/doctor registration and sign-in (steps 1, 3, 5); Terms & Privacy pages (step 4).
- **Patient** — register + profile (name, DOB, weight, height, phone, medical history) (step 5); doctor discovery/search (step 6); guided matching (step 7); book a consultation (step 8); booking notification (step 8).
- **Doctor** — register + profile + specialization (step 1); schedule management (steps 2, 9); patient records (step 9).
- **Admin** — pre-provisioned sign-in (steps 3, 10); doctor profile review (step 3); appointment oversight (step 10); operational dashboard (step 10); audit log (step 10).

### Missing (to implement one by one)

Core journey (§2) — the clinical half that currently stops at booking:

- [ ] **Consultation session** — patient & doctor join the workspace and walk the state machine `SCHEDULED → JOINED → IN_PROGRESS → COMPLETED`.
  - UI: `apps/web/app/consultation/[appointmentId]/page.tsx` · API: `apps/api/src/consultations`
- [ ] **Consultation note + prescription** — doctor records findings and a prescription after completing the session.
  - UI: doctor panel on the consultation page (note form + prescription form)
- [ ] **Medical records** — patient later views the note/prescription in `/patient/records`.
  - UI: `apps/web/app/patient/records/page.tsx`
- [ ] **Reschedule / cancel** — patient reschedules or cancels the booked appointment.
  - UI: `apps/web/app/patient/appointments/page.tsx`

Module requirements (§5):

- [ ] **Admin user management** — search accounts and activate / suspend / deactivate.
  - UI: `apps/web/app/admin/users/page.tsx`
- [ ] **Trust messaging in step 4** — assert the fictional-prototype disclaimer on the landing page (the doc mentions it; the spec doesn't check it).

### Partially covered

- **Notifications** — only the patient's "Appointment confirmed" booking notice is asserted; the doctor's "New appointment booked", plus cancellation and schedule-change notices, are not shown.
- **Doctor patient records** — only the patient's name is asserted (step 9); the full history / notes / prescriptions view is not exercised.
