import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface HealthPayload {
  status: 'ok' | 'error';
  uptimeSeconds: number;
  database: 'up' | 'down';
  version: string;
}

/**
 * Liveness + database readiness (docs/API_SPEC.md §2). Returns 503 with
 * `database: "down"` when Postgres is unreachable.
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthPayload> {
    const uptimeSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    if (database === 'down') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', uptimeSeconds, database, version: '1.0.0' };
    }
    return { status: 'ok', uptimeSeconds, database, version: '1.0.0' };
  }
}
