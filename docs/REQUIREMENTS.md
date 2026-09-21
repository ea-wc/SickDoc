# Product Requirements

Scope of the telehealth prototype. Every requirement is implemented inside the
application runtime (frontend + NestJS + Prisma + PostgreSQL). No SaaS, BaaS, or
external runtime API may be used for authentication, matching, notifications,
messaging, file storage, scheduling, conferencing, or medical records.

All clinical content is fictional and the product carries a prototype disclaimer.

## 1. Objective

A functional telehealth web application with a public product landing page.
Visitors understand the service; patients register, find a suitable doctor, book a
consultation, and connect with that doctor online; doctors run their schedule and
record outcomes; admins oversee the platform.

## 2. Roles

| Role | Responsibilities |
|---|---|
| Visitor | Reads the landing page, registers as patient or doctor, signs in |
| Patient | Books and attends consultations, reviews appointment history and medical records |
| Doctor | Manages professional profile, availability, consultations, prescriptions, notes |
| Admin | Oversees user accounts, doctor profiles, appointments, and audit activity |

Admin accounts are pre-provisioned by seed. There is no public admin registration.

## 3. Core user journey

1. A visitor lands on the Product Website and chooses to register or sign in as a
   patient or doctor.
2. A patient creates an account and completes a basic profile.
3. The patient discovers a doctor by availability, specialization, or healthcare need.
4. The patient books, reschedules, or cancels a consultation.
5. Patient and doctor access the scheduled consultation session.
6. The doctor records consultation notes or a prescription the patient can later view.

This journey is the definition of done. Everything else is secondary.

## 4. Modules

### 4.1 Product Website

| ID | Requirement | Acceptance criteria |
|---|---|---|
| PW-1 | Landing page | Public, responsive page communicating value proposition, core capabilities, and how the service works. Reachable at `/` without a session. |
| PW-2 | Navigation and CTAs | Header and primary CTAs route to patient registration, doctor registration, and sign-in. |
| PW-3 | Trust and information | Fictional-prototype disclaimer visible on the landing page; privacy and safety messaging; links to application-managed `/terms` and `/privacy` pages. |
| PW-4 | Standalone content | Copy, icons, images, and assets are served by the application. No external CMS, analytics, form service, image host, or marketing SaaS. |

### 4.2 Patient module

| ID | Requirement | Acceptance criteria |
|---|---|---|
| PT-1 | Account | Register with email + password via application-managed auth. Credentials and profile stored in PostgreSQL. |
| PT-2 | Profile | Capture name, birthday, weight, height, contact details, basic medical history. Avatar is generated initials or an application-provided asset — no external file storage. |
| PT-3 | Doctor discovery | Browse and search approved doctor profiles by name, specialization, and availability, all read from PostgreSQL. No external provider directory or calendar. |
| PT-4 | Guided matching | Patient selects or describes symptoms; the backend suggests doctors using deterministic specialty-matching rules implemented in NestJS with mappings stored in the database. No external AI service, no model call at runtime. |
| PT-5 | Booking | Book, reschedule, or cancel a consultation against application-stored availability. Availability and booking-conflict rules enforced server-side. |
| PT-6 | Notifications | Database-backed in-app notifications for bookings, upcoming appointments, cancellations, and schedule changes. No email, SMS, or push dependency. |
| PT-7 | Consultation session | Join a first-party consultation workspace showing appointment context and tracking `SCHEDULED → JOINED → IN_PROGRESS → COMPLETED`. Audio/video streaming is not required. |
| PT-8 | Medical records | View own appointment history, consultation notes, and prescriptions, with role-based access enforced in NestJS. |

### 4.3 Doctor module

| ID | Requirement | Acceptance criteria |
|---|---|---|
| DR-1 | Account | Register with application-managed email + password authentication. |
| DR-2 | Profile | Store profile details, biography, and specializations in PostgreSQL. Profile begins `PENDING` and is visible in discovery only once `APPROVED`. |
| DR-3 | Patient records | View appointment history, consultation records, and prescriptions for patients the doctor has an appointment with, subject to role-based access. |
| DR-4 | Schedule management | Create and manage consultation availability; unavailable slots are not bookable; overlapping or invalid bookings are rejected by NestJS. No external calendar. |
| DR-5 | Notifications | Same database-backed in-app notification guarantees as PT-6. |
| DR-6 | Notes and prescriptions | Record findings, recommendations, prescriptions, and a consultation summary after an appointment. Persisted in PostgreSQL and readable by the patient. |
| DR-7 | Consultation session | Join and manage the same first-party workspace, update session state, and record outcomes. |

### 4.4 Admin module

| ID | Requirement | Acceptance criteria |
|---|---|---|
| AD-1 | Access | Sign in with a pre-provisioned admin account. No public admin registration. Admin permissions enforced in NestJS, not only in the UI. |
| AD-2 | User management | View and search patient and doctor accounts; activate, suspend, or deactivate them. Account state and reason stored in PostgreSQL. |
| AD-3 | Doctor profile review | Review, approve, reject, or update doctor profiles and specialization data. No external verification service. |
| AD-4 | Appointment oversight | View all appointments and consultation states; resolve invalid bookings; cancel appointments when necessary. |
| AD-5 | Operational dashboard | Display database-derived counts for users, doctors, appointments, and consultation states. No external analytics. |
| AD-6 | Audit log | Record admin actions, affected record, timestamp, and optional reason for traceability. |

## 5. Cross-cutting rules

- **Authorization** — every record access is checked server-side against the caller's
  role and ownership. A patient reads only their own records; a doctor reads only
  patients they have an appointment with; an admin reads all.
- **Suspended accounts** cannot sign in or hold active appointments.
- **Time** — all timestamps persisted in UTC; rendered in the viewer's local zone.
- **Fictional data** — the seed provides demo patients, doctors, specializations,
  symptom mappings, and appointments so the journey is demonstrable immediately.

## 6. Prioritization

1. Core journey end to end (PW-1..2, PT-1..8, DR-1..7) before anything else.
2. Admin module (AD-1..6) next — it is required scope, not bonus.
3. A smaller, polished, coherent solution beats an ambitious unfinished one.

### Bonus features

Optional, must stay relevant to telehealth, must respect the standalone-runtime rule,
and must not introduce SaaS, BaaS, or external feature APIs. Candidates that
differentiate rather than pad:

- Waitlist with automatic promotion when a slot is cancelled.
- Patient-facing visit summary export rendered by the application.
- Doctor analytics on consultation outcomes derived from the database.
- Structured prescription refill requests routed back to the prescribing doctor.

## 7. Out of scope

Real audio/video streaming, real prescribing or clinical decision support, payments
and insurance, email/SMS/push delivery, external identity providers, file uploads to
external storage, and any production-grade compliance posture (HIPAA, GDPR DPA).

## 8. Evaluation criteria

Submissions are assessed on functionality and scope covered, design and product sense,
adherence and code quality, and presentation and communication.
