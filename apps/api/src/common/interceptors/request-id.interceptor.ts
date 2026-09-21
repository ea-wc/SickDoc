import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Assigns (or echoes) a request id on every request, exposes it as the
 * `x-request-id` response header, and emits one structured JSON log line per
 * request (docs/API_SPEC.md §1 "Request id").
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { requestId?: string }>();
    const res = http.getResponse<Response>();

    const requestId = this.header(req, 'x-request-id') ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const route = `${req.method} ${req.originalUrl ?? req.url}`;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(requestId, route, res.statusCode, startedAt),
        error: () => this.log(requestId, route, 'error', startedAt),
      }),
    );
  }

  private log(requestId: string, route: string, status: number | string, startedAt: number): void {
    const durationMs = Date.now() - startedAt;
    this.logger.log(JSON.stringify({ requestId, route, status, durationMs }));
  }

  private header(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
