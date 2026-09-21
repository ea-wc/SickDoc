import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from '../constants.js';
import { AppException } from '../exceptions/app.exception.js';
import type { AuthenticatedUser, JwtPayload } from '../auth.types.js';

/**
 * Global bearer-token guard. Routes decorated with `@Public()` are skipped.
 *
 * Every authenticated request re-reads the user row from the database so that
 * a suspension or deactivation is honoured immediately, not merely at the next
 * login (docs/API_SPEC.md §1 "Status re-check against the database").
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new AppException(ErrorCodes.TOKEN_INVALID, 'Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch (error) {
      const expired = (error as { name?: string }).name === 'TokenExpiredError';
      throw new AppException(
        expired ? ErrorCodes.TOKEN_EXPIRED : ErrorCodes.TOKEN_INVALID,
        expired ? 'Access token has expired' : 'Access token is invalid',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true, statusReason: true },
    });
    if (!user) {
      throw new AppException(ErrorCodes.TOKEN_INVALID, 'Access token is invalid');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new AppException(ErrorCodes.ACCOUNT_SUSPENDED, 'Account is suspended', [
        { field: 'statusReason', issue: user.statusReason ?? 'No reason provided' },
      ]);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(ErrorCodes.FORBIDDEN, 'Account is not active');
    }

    request.user = user;
    return true;
  }

  private extractBearer(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
    return token;
  }
}
