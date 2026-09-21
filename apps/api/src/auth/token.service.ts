import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ErrorCodes } from '@sickdoc/shared';
import { createHash, randomBytes } from 'node:crypto';
import { AppException } from '../common/exceptions/app.exception.js';
import type { JwtPayload } from '../common/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const REFRESH_COOKIE = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/api/auth';

const REFRESH_TTL_SECONDS = Number(process.env.JWT_REFRESH_TTL ?? 604800);

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Issues access JWTs and opaque rotating refresh tokens. Only the sha256 hash
 * of a refresh token is stored (docs/DATA_MODEL.md §3), so a database leak does
 * not expose usable tokens.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  get accessTtlSeconds(): number {
    return Number(process.env.JWT_ACCESS_TTL ?? 900);
  }

  get refreshTtlSeconds(): number {
    return REFRESH_TTL_SECONDS;
  }

  async issueAccessToken(user: { id: string; email: string; role: Role }): Promise<{ accessToken: string; expiresIn: number }> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, expiresIn: this.accessTtlSeconds };
  }

  async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hash(token), expiresAt },
    });
    return { token, expiresAt };
  }

  /** Validates a presented refresh token, revokes it, and issues a replacement. */
  async rotate(rawToken: string): Promise<{ userId: string; next: IssuedRefreshToken }> {
    const row = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!row) {
      throw new AppException(ErrorCodes.TOKEN_INVALID, 'Refresh token is invalid');
    }
    if (row.revokedAt) {
      throw new AppException(ErrorCodes.TOKEN_INVALID, 'Refresh token has been revoked');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new AppException(ErrorCodes.TOKEN_EXPIRED, 'Refresh token has expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    const next = await this.issueRefreshToken(row.userId);
    return { userId: row.userId, next };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
