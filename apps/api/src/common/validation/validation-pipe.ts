import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ErrorCodes, ErrorDetail } from '@sickdoc/shared';
import { ValidationError } from 'class-validator';

function flattenErrors(errors: ValidationError[], parentPath = ''): ErrorDetail[] {
  const result: ErrorDetail[] = [];
  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints) {
      for (const issue of Object.values(error.constraints)) {
        result.push({ field: path, issue });
      }
    } else if (!error.children || error.children.length === 0) {
      // forbidNonWhitelisted: an unknown property has no constraints or children.
      result.push({ field: path, issue: 'property is not allowed' });
    }
    if (error.children && error.children.length > 0) {
      result.push(...flattenErrors(error.children, path));
    }
  }
  return result;
}

/**
 * Global ValidationPipe factory (docs/TECHNICAL_REQUIREMENTS.md §4):
 * unknown body properties are rejected, payloads are transformed into DTO
 * instances, and failures are shaped into the API_SPEC §1 error envelope.
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'Validation failed',
        details: flattenErrors(errors),
      }),
  });
}
