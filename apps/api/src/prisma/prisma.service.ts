import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around PrismaClient that owns the connection lifecycle.
 *
 * `onModuleInit` connects eagerly at bootstrap; `onModuleDestroy` closes the
 * connection pool during Nest's graceful shutdown (enabled via
 * `app.enableShutdownHooks()` in `main.ts`), so in-flight queries drain before
 * the process exits.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }
}
