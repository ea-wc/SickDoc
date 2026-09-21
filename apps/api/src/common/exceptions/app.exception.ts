import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorDetail, ERROR_STATUS } from '@sickdoc/shared';

/**
 * Domain exception carrying an API_SPEC §1 error code. The global exception
 * filter maps the code to its HTTP status (via `ERROR_STATUS`) and renders the
 * standard error envelope.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super({ code, message, details }, ERROR_STATUS[code]);
    this.code = code;
    this.details = details;
  }
}
