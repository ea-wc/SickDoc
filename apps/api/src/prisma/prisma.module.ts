import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** Exposes PrismaService application-wide without per-module imports. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
