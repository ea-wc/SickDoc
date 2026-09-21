import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import { ROLES_KEY } from '../constants.js';
import { AppException } from '../exceptions/app.exception.js';
import type { AuthenticatedUser } from '../auth.types.js';

/**
 * Global authorization guard. Routes (or controllers) carrying `@Roles(...)`
 * are restricted to those roles; everything else passes through.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !required.includes(user.role)) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'You do not have permission to access this resource');
    }
    return true;
  }
}
