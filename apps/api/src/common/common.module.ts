import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { DomainEventsService } from './events/domain-events.service.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { RequestIdInterceptor } from './interceptors/request-id.interceptor.js';
import { buildValidationPipe } from './validation/validation-pipe.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
const JWT_ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);
const AUTH_THROTTLE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Cross-cutting infrastructure, registered once and applied globally:
 * global guards (bearer auth + roles), the exception filter, the request-id
 * interceptor, the validation pipe, JWT signing, and the rate limiter used by
 * the auth routes.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: JWT_ACCESS_TTL },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: AUTH_THROTTLE_TTL, limit: 10 }],
    }),
  ],
  providers: [
    DomainEventsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_PIPE, useFactory: () => buildValidationPipe() },
  ],
  exports: [JwtModule, DomainEventsService],
})
export class CommonModule {}
