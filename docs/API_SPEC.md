# API Specification

REST, JSON over HTTP. Base path `/api`. Served by the NestJS container on port 3001.
Entity fields referenced here are defined in [DATA_MODEL.md](DATA_MODEL.md).

## 1. Conventions

- **Content type** — `application/json; charset=utf-8` on request and response.
- **Auth** — `Authorization: Bearer <accessToken>` unless a route is marked *public*.
  The refresh token travels as an `httpOnly` cookie, never in a body.
- **Ids** — uuid v4 strings.
- **Timestamps** — ISO 8601 with offset, always UTC (`2026-09-21T09:30:00.000Z`).
- **Request id** — every response carries `x-request-id`; send your own to have it echoed.
- **Casing** — `camelCase` everywhere.
- **Validation** — unknown body properties are rejected (`400 VALIDATION_FAILED`).

### Pagination

List endpoints accept `page` (1-based, default 1) and `pageSize` (default 20, max 100)
and return:

```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 } }
```

### Error envelope

Every non-2xx response:

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "That time is no longer available.",
    "details": [{ "field": "startsAt", "issue": "conflicts with an existing appointment" }],
    "requestId": "b2c1…",
    "timestamp": "2026-09-21T09:30:00.000Z"
  }
}
```

| HTTP | Codes |
|---|---|
| 400 | `VALIDATION_FAILED`, `INVALID_DATE_RANGE` |
| 401 | `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_INVALID` |
| 403 | `FORBIDDEN`, `ACCOUNT_SUSPENDED`, `DOCTOR_NOT_APPROVED` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `SLOT_UNAVAILABLE`, `PATIENT_DOUBLE_BOOKED`, `INVALID_STATE_TRANSITION`, `NOTE_ALREADY_EXISTS` |
| 422 | `BUSINESS_RULE_VIOLATION` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

`401 TOKEN_EXPIRED` is the client's signal to call `/auth/refresh` once and retry.

### Authorization matrix

| Prefix | Patient | Doctor | Admin |
|---|:--:|:--:|:--:|
| `/auth/*` | public / self | public / self | public / self |
| `/me` | ✓ | ✓ | ✓ |
| `/doctors` (directory) | ✓ | ✓ | ✓ |
| `/patients/me/*` | ✓ | — | — |
| `/doctors/me/*` | — | ✓ | — |
| `/matching/*` | ✓ | — | — |
| `/appointments` | own | own | all (via `/admin`) |
| `/consultations/*` | own | own | read via `/admin` |
| `/notifications` | own | own | own |
| `/admin/*` | — | — | ✓ |

Role is checked by a guard; ownership is checked again in the service.

---

## 2. Health

### `GET /api/health` *(public)*

```json
{ "status": "ok", "uptimeSeconds": 1284, "database": "up", "version": "1.0.0" }
```

Returns `503` with `"database": "down"` if Postgres is unreachable.

---

## 3. Auth

### `POST /api/auth/register/patient` *(public)*

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "birthDate": "1990-12-10",
  "phone": "+63 900 000 0000"
}
```

`201` → same shape as login. Password: minimum 10 characters, at least one letter and
one digit. `409 EMAIL_TAKEN` if the email exists.

### `POST /api/auth/register/doctor` *(public)*

```json
{
  "email": "dr.chen@example.com",
  "password": "…",
  "firstName": "Mei",
  "lastName": "Chen",
  "title": "MD",
  "licenseNumber": "PH-123456",
  "yearsOfExperience": 11,
  "timezone": "Asia/Manila",
  "bio": "Cardiologist focused on preventive care.",
  "specializationIds": ["…"],
  "primarySpecializationId": "…"
}
```

`201`. The account is created `ACTIVE` with `DoctorProfile.status = PENDING`; the
doctor can sign in and manage their profile and availability but does not appear in
patient discovery until an admin approves.

### `POST /api/auth/login` *(public)*

```json
{ "email": "ada@example.com", "password": "…" }
```

`200`:

```json
{
  "accessToken": "eyJ…",
  "expiresIn": 900,
  "user": {
    "id": "…", "email": "ada@example.com", "role": "PATIENT", "status": "ACTIVE",
    "displayName": "Ada Lovelace", "initials": "AL", "avatarColor": "#3B82F6",
    "doctorStatus": null
  }
}
```

Sets `refreshToken` cookie. `401 INVALID_CREDENTIALS` on bad email or password — the
same code for both, deliberately. `403 ACCOUNT_SUSPENDED` carries `statusReason`.
Rate limited to 10 attempts per 15 minutes per IP + email.

### `POST /api/auth/refresh` *(public, cookie-authenticated)*

Rotates the refresh token and returns a new access token in the login shape.

### `POST /api/auth/logout`

Revokes the current refresh token and clears the cookie. `204`.

### `GET /api/me`

The authenticated user plus their profile (`patient` or `doctor` object, per role).

### `PATCH /api/me/password`

`{ "currentPassword": "…", "newPassword": "…" }` → `204`. Revokes all other refresh tokens.

---

## 4. Patient profile

### `GET /api/patients/me`
### `PATCH /api/patients/me`

Any subset of `firstName`, `lastName`, `birthDate`, `sex`, `weightKg`, `heightCm`,
`phone`, `addressLine`, `city`, `country`, `medicalHistory`, `allergies`, `conditions`.
Returns the updated profile.

---

## 5. Doctor directory (patient-facing)

### `GET /api/specializations` 

`{ "data": [{ "id": "…", "slug": "cardiology", "name": "Cardiology", "doctorCount": 4 }] }`

### `GET /api/doctors`

Query: `q` (name or bio), `specializationId`, `availableFrom`, `availableTo`,
`language`, `minExperience`, `sort` (`relevance` | `experience` | `earliestSlot`),
`page`, `pageSize`.

Returns approved, active doctors only:

```json
{
  "data": [{
    "id": "…", "displayName": "Dr. Mei Chen", "title": "MD", "initials": "MC",
    "avatarColor": "#10B981", "bio": "…", "yearsOfExperience": 11,
    "languages": ["English", "Filipino"], "timezone": "Asia/Manila",
    "consultationFee": "1500.00",
    "specializations": [{ "id": "…", "name": "Cardiology", "isPrimary": true }],
    "nextAvailableAt": "2026-09-22T01:00:00.000Z"
  }],
  "meta": { "page": 1, "pageSize": 20, "total": 8, "totalPages": 1 }
}
```

### `GET /api/doctors/:id`

Full public profile. `404 NOT_FOUND` if the doctor is not approved — a non-approved
profile is not disclosed as existing.

### `GET /api/doctors/:id/slots`

Query: `from` (date, required), `to` (date, required, max 31 days after `from`).

```json
{
  "data": [{
    "date": "2026-09-22",
    "slots": [
      { "startsAt": "2026-09-22T01:00:00.000Z", "endsAt": "2026-09-22T01:30:00.000Z", "available": true },
      { "startsAt": "2026-09-22T01:30:00.000Z", "endsAt": "2026-09-22T02:00:00.000Z", "available": false }
    ]
  }],
  "meta": { "timezone": "Asia/Manila", "slotMinutes": 30, "leadTimeMinutes": 60 }
}
```

Derived at read time; never cached across a booking.

---

## 6. Guided matching

### `GET /api/symptoms`

Optional `q`. `{ "data": [{ "id": "…", "slug": "chest-pain", "label": "Chest pain", "bodySystem": "cardiovascular" }] }`

### `POST /api/matching/suggest`

```json
{ "symptomIds": ["…", "…"], "freeText": "tight chest when climbing stairs", "limit": 5 }
```

At least one of `symptomIds` or `freeText` is required. `freeText` is normalized and
matched locally against symptom slugs and synonyms — deterministic, no external service.

`200`:

```json
{
  "matchedSymptoms": [{ "id": "…", "label": "Chest pain", "source": "selected" },
                      { "id": "…", "label": "Shortness of breath", "source": "freeText" }],
  "suggestions": [{
    "doctor": { "id": "…", "displayName": "Dr. Mei Chen", "initials": "MC", "…": "as in /doctors" },
    "score": 18.5,
    "nextAvailableAt": "2026-09-22T01:00:00.000Z",
    "rationale": {
      "specializations": [{ "name": "Cardiology", "weight": 9 }, { "name": "Internal Medicine", "weight": 5 }],
      "availabilityBonus": 3,
      "experienceBonus": 1.5
    }
  }]
}
```

`rationale` is part of the contract, not a debug field — the patient-facing UI shows
why a doctor was suggested.

---

## 7. Appointments

### `POST /api/appointments` *(patient)*

```json
{ "doctorId": "…", "startsAt": "2026-09-22T01:00:00.000Z", "reason": "Chest tightness on exertion", "symptomIds": ["…"] }
```

`201` returns the appointment with its embedded session. Errors: `409 SLOT_UNAVAILABLE`,
`409 PATIENT_DOUBLE_BOOKED`, `403 DOCTOR_NOT_APPROVED`,
`422 BUSINESS_RULE_VIOLATION` (in the past, or beyond the 90-day booking horizon).
Creates notifications for both parties.

### `GET /api/appointments`

Scoped to the caller automatically — a patient sees their own, a doctor sees theirs.
Query: `status` (repeatable), `from`, `to`, `scope` (`upcoming` | `past` | `all`,
default `upcoming`), `page`, `pageSize`.

```json
{
  "data": [{
    "id": "…", "startsAt": "…", "endsAt": "…", "status": "CONFIRMED",
    "reason": "Chest tightness on exertion",
    "patient": { "id": "…", "displayName": "Ada Lovelace", "initials": "AL", "avatarColor": "#3B82F6" },
    "doctor":  { "id": "…", "displayName": "Dr. Mei Chen", "initials": "MC", "avatarColor": "#10B981",
                 "primarySpecialization": "Cardiology" },
    "session": { "id": "…", "status": "SCHEDULED" },
    "hasNote": false, "prescriptionCount": 0,
    "createdAt": "…"
  }],
  "meta": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 }
}
```

### `GET /api/appointments/:id`

Full detail including note and prescriptions when the caller may see them.
`404 NOT_FOUND` — not `403` — when the caller is unrelated to the appointment.

### `PATCH /api/appointments/:id/reschedule` *(patient, or doctor)*

`{ "startsAt": "2026-09-23T02:00:00.000Z", "reason": "Work conflict" }`

Validated like a new booking. The old appointment moves to `RESCHEDULED` and the new
one carries `rescheduledFromId`. Notifies the other party.

### `PATCH /api/appointments/:id/cancel` *(patient, doctor, or admin)*

`{ "reason": "Feeling better" }` → the appointment becomes `CANCELLED` with
`cancelledBy` set from the caller's role, and its session becomes `CANCELLED`.
`409 INVALID_STATE_TRANSITION` if already completed or cancelled.

---

## 8. Consultation session

### `GET /api/consultations/:appointmentId`

The workspace payload: appointment context, both participants, session state,
timestamps, and — for the doctor — the patient's relevant history summary.

### `POST /api/consultations/:appointmentId/join`

Marks the caller joined. `SCHEDULED → JOINED`.

### `POST /api/consultations/:appointmentId/start` *(doctor)*

`JOINED → IN_PROGRESS`, sets `startedAt`.

### `POST /api/consultations/:appointmentId/complete` *(doctor)*

`IN_PROGRESS → COMPLETED`, sets `endedAt` and `durationSeconds`, moves the appointment
to `COMPLETED`, and notifies the patient that records are available.

### `POST /api/consultations/:appointmentId/no-show` *(doctor)*

Marks `NO_SHOW` when the patient never joined and the grace period has passed.

Any disallowed transition returns `409 INVALID_STATE_TRANSITION` with the current and
attempted states in `details`.

---

## 9. Clinical records

### `POST /api/appointments/:id/note` *(doctor who owns the appointment)*

```json
{ "subjective": "…", "objective": "…", "assessment": "Stable angina, suspected",
  "plan": "ECG, start low-dose aspirin, review in 2 weeks",
  "summary": "Discussed exertional chest tightness…", "followUpAt": "2026-10-06T01:00:00.000Z" }
```

`201`. `409 NOTE_ALREADY_EXISTS` — use `PATCH` to amend. Only allowed while the
session is `IN_PROGRESS` or `COMPLETED`.

### `PATCH /api/appointments/:id/note` *(author only)*
### `GET /api/appointments/:id/note`

Patient may read once the session is `COMPLETED`.

### `POST /api/appointments/:id/prescriptions` *(doctor)*

```json
{
  "notes": "Take with food.",
  "validUntil": "2026-12-31",
  "items": [{ "drugName": "Aspirin", "dosage": "81 mg", "frequency": "once daily",
              "durationDays": 30, "instructions": "Morning, after breakfast" }]
}
```

`201`. At least one item required. Notifies the patient.

### `GET /api/records/me` *(patient)*

The patient's own record timeline: completed appointments with their notes and
prescriptions, newest first. Query `type` (`appointments` | `notes` | `prescriptions`),
`from`, `to`, `page`, `pageSize`.

### `GET /api/records/patients/:patientId` *(doctor)*

`403 FORBIDDEN` unless the doctor has at least one appointment with that patient.
Returns only records generated in that clinical relationship plus the patient's
profile-level history, allergies, and conditions.

---

## 10. Doctor self-service

### `GET /api/doctors/me` · `PATCH /api/doctors/me`

Editable: `firstName`, `lastName`, `title`, `bio`, `yearsOfExperience`,
`consultationFee`, `languages`, `timezone`, `specializationIds`,
`primarySpecializationId`. Editing a `REJECTED` profile returns it to `PENDING`.

### `GET /api/doctors/me/availability`

```json
{
  "rules": [{ "id": "…", "weekday": 1, "startMinute": 540, "endMinute": 1020,
              "slotMinutes": 30, "isActive": true }],
  "exceptions": [{ "id": "…", "startsAt": "…", "endsAt": "…", "reason": "Conference" }],
  "timezone": "Asia/Manila"
}
```

### `PUT /api/doctors/me/availability`

Replaces the full rule set atomically. `400 VALIDATION_FAILED` on overlapping rules for
the same weekday. Existing appointments are never deleted — any that fall outside the
new availability are returned in `meta.conflicts` so the doctor can reschedule them,
and both parties are notified of the schedule change.

### `POST /api/doctors/me/availability/exceptions` · `DELETE …/exceptions/:id`

Adding an exception that covers active appointments returns
`409 BUSINESS_RULE_VIOLATION` listing them; the doctor must cancel or reschedule first.

---

## 11. Notifications

### `GET /api/notifications`

Query: `unread` (bool), `page`, `pageSize`. Returns notifications for the caller with
`meta.unreadCount`. Polled by the client every 30 seconds.

### `PATCH /api/notifications/:id/read` → `204`
### `PATCH /api/notifications/read-all` → `{ "updated": 7 }`

---

## 12. Admin

All routes require `role = ADMIN`. Every mutation writes an `AuditLog` row in the same
transaction.

### `GET /api/admin/dashboard`

```json
{
  "users": { "total": 142, "patients": 120, "doctors": 21, "admins": 1,
             "active": 138, "suspended": 3, "deactivated": 1 },
  "doctors": { "pending": 2, "approved": 18, "rejected": 1 },
  "appointments": { "total": 486, "upcoming": 37, "completed": 402,
                    "cancelled": 41, "noShow": 6 },
  "sessions": { "scheduled": 37, "inProgress": 2, "completed": 402 },
  "recentAuditCount": 24
}
```

All counts are database aggregates. No external analytics.

### `GET /api/admin/users`

Query: `q`, `role`, `status`, `page`, `pageSize`.

### `GET /api/admin/users/:id`

Account, profile, and a summary of appointment activity.

### `PATCH /api/admin/users/:id/status`

`{ "status": "SUSPENDED", "reason": "Reported misuse" }` — `reason` required for
`SUSPENDED` and `DEACTIVATED`. Revokes the user's refresh tokens, notifies them, and
audits the action. An admin cannot change their own status (`422`).

### `GET /api/admin/doctors`

Query: `q` (search by doctor name or email), `status` (`PENDING`/`APPROVED`/`REJECTED`), `page`, `pageSize`.

### `PATCH /api/admin/doctors/:id/review`

`{ "decision": "APPROVED" }` or `{ "decision": "REJECTED", "reason": "License unverifiable" }`.
Approval makes the profile visible in discovery; both outcomes notify the doctor.

### `PATCH /api/admin/doctors/:id/profile`

Admin correction of profile fields. Audited with a before/after fragment in `metadata`.

### `GET /api/admin/appointments`

Query: `q`, `status`, `sessionStatus`, `doctorId`, `patientId`, `from`, `to`,
`invalidOnly` (bool — surfaces appointments whose slot no longer matches the doctor's
availability, or that are stuck past their end time). Returns all appointments.

### `PATCH /api/admin/appointments/:id/cancel`

`{ "reason": "Duplicate booking" }` — cancels with `cancelledBy = ADMIN` and notifies
both parties.

### `PATCH /api/admin/appointments/:id/resolve`

`{ "action": "MARK_NO_SHOW" | "FORCE_COMPLETE", "reason": "…" }` for sessions left in a
dangling state.

### `GET /api/admin/audit-logs`

Query: `actorUserId`, `action`, `entityType`, `entityId`, `from`, `to`, `page`,
`pageSize`. Newest first. Read-only — the API exposes no write, update, or delete path.

---

## 13. Status code summary

| Method | Success |
|---|---|
| `GET` | `200` |
| `POST` creating a resource | `201` |
| `POST` performing an action | `200` |
| `PATCH` / `PUT` | `200` (`204` when no body) |
| `DELETE` | `204` |

OpenAPI is generated from the controller decorators and served at `/api/docs`
(Swagger UI) in non-production environments.
