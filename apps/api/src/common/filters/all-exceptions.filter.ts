import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorCode, ErrorCodes, ErrorDetail, ErrorEnvelope } from '@sickdoc/shared';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppException } from '../exceptions/app.exception.js';

interface ShapedBody {
  code?: ErrorCode;
  message?: string | string[];
  details?: ErrorDetail[];
}

/**
 * Global exception filter. Every non-2xx response is rendered as the
 * API_SPEC §1 error envelope and carries the request id. Stack traces are
 * logged server-side but never leaked to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCodes.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: ErrorDetail[] | undefined;

    if (exception instanceof AppException) {
      const body = exception.getResponse() as ShapedBody;
      status = exception.getStatus();
      code = body.code ?? ErrorCodes.INTERNAL_ERROR;
      message = typeof body.message === 'string' ? body.message : message;
      details = body.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as ShapedBody | string;
      if (typeof body === 'object' && body.code) {
        // The ValidationPipe's exceptionFactory already shaped the body.
        code = body.code;
        message = typeof body.message === 'string' ? body.message : 'Request failed';
        details = body.details;
      } else if (status === HttpStatus.BAD_REQUEST) {
        code = ErrorCodes.VALIDATION_FAILED;
        message = 'Validation failed';
      } else {
        code = this.codeForStatus(status);
        message = typeof body === 'string' ? body : 'Request failed';
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const requestId = req.requestId ?? this.header(req, 'x-request-id') ?? randomUUID();
    const envelope: ErrorEnvelope = {
      error: { code, message, details, requestId, timestamp: new Date().toISOString() },
    };

    if (!res.headersSent) {
      res.setHeader('x-request-id', requestId);
      res.status(status).json(envelope);
    }
  }

  private header(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.NOT_FOUND;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.TOKEN_INVALID;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCodes.RATE_LIMITED;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
