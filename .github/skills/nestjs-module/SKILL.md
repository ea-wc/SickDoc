---
name: nestjs-module
description: 'Scaffold or extend a SickDoc NestJS feature module in apps/api. Use when adding a new module, controller, service, DTO, or domain logic to the API — covers ESM .js imports, module/controller/service/dto layout, @Public/@Roles/@CurrentUser decorators, AppException + shared ErrorCodes, Prisma serializable transactions, and co-located vitest specs.'
---

# SickDoc NestJS Module

## When to Use
- Adding a new bounded concern (module) under `apps/api/src/<feature>/`
- Adding endpoints, DTOs, or domain logic to an existing module

## Non-negotiable rules (see `AGENTS.md` for the full list)
- **ESM `nodenext`**: every relative import needs a `.js` extension (`import { X } from './foo.js'`); package imports (`@sickdoc/shared`, `@prisma/client`, `@nestjs/*`) are extensionless. No path aliases.
- Enums (`Role`, `AppointmentStatus`, `SessionStatus`, …) are imported from **`@prisma/client`** on the API side (not from `@sickdoc/shared`).
- Error codes come from `ErrorCodes` in `@sickdoc/shared`.

## File layout for a new feature `<feature>`
```
apps/api/src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  dto/<feature>.dto.ts
  <domain-logic>.ts + <domain-logic>.spec.ts   # optional: pure logic, co-located test
```

## Steps

### 1. DTO (`dto/<feature>.dto.ts`)
- class-validator + class-transformer decorators; definite assignment `field!: string` (deliberate — `strictPropertyInitialization: false`).
- Extend `../../common/dto/pagination-query.dto.js` for list queries.
- Canonical example: `apps/api/src/appointments/dto/appointment.dto.ts`.

### 2. Controller (`<feature>.controller.ts`)
- Thin: validate (global `ValidationPipe`), delegate to the service, return its result directly. Never touch Prisma.
- Route decorators: `@Controller('<feature>')`, `@Get/@Post/@Patch/@Delete`, `@HttpCode(HttpStatus.CREATED)`.
- Auth: `@Public()` for public routes, `@Roles(Role.X)` for role-gated routes, `@CurrentUser() user: AuthenticatedUser` to read the caller.

```ts
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(Role.PATIENT)
  @HttpCode(HttpStatus.CREATED)
  book(@CurrentUser() user: AuthenticatedUser, @Body() dto: BookAppointmentDto) {
    return this.appointmentsService.book(user, dto);
  }
}
```

### 3. Service (`<feature>.service.ts`)
- All business rules, ownership checks, and transactions live here. Never read the request object.
- Ownership via helper methods that map user→resource (e.g. `relationshipOf`, `participationOf`, `assertDoctor`). Unauthorized lookups throw `NOT_FOUND` (not `403`) to avoid leaking existence.
- Errors: `throw new AppException(ErrorCodes.SOME_CODE, 'message', details)`.

### 4. Module + wiring
```ts
import { Module } from '@nestjs/common';

@Module({
  imports: [/* cross-module deps only — PrismaService is @Global */],
  controllers: [XController],
  providers: [XService],
})
export class XModule {}
```
- Register the new module in `src/app.module.ts`.

### 5. Transactions (mutations)
- Booking/reschedule/cancel-style mutations must use a **serializable** interactive transaction (`{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }`) and catch `P2002` unique violations as `SLOT_UNAVAILABLE`.
- Admin mutations append an `AuditLog` row inside the same transaction.
- Reference: `apps/api/src/appointments/appointments.service.ts`.

### 6. Tests
- Co-located vitest spec (`*.spec.ts`) importing pure logic from `./<file>.js`.
- Run unit tests: `pnpm --filter @sickdoc/api test`. Full e2e: `pnpm test:e2e` (root).

## References
- Canonical modules: `apps/api/src/appointments/`, `apps/api/src/consultations/`
- Errors: `packages/shared/src/errors.ts` · `apps/api/src/common/exceptions/app.exception.ts`
- Guards/decorators/pipe: `apps/api/src/common/`
