import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

interface ApiErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  details?: unknown;
}

/**
 * Format error konsisten — backend-architecture-hr.md §4:
 * { success: false, errorCode, message, details }.
 * errorCode default diturunkan dari nama exception (mis. NotFoundException
 * -> "NOT_FOUND"); bisa dioverride dengan melempar
 * `throw new ConflictException({ errorCode: 'X', message: '...' })`.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = exception.message;
    let errorCode = this.deriveErrorCode(exception, status);
    let details: unknown;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const body = exceptionResponse as Record<string, unknown>;

      if (Array.isArray(body.message)) {
        message = 'Validasi input gagal';
        errorCode = 'VALIDATION_ERROR';
        details = { errors: body.message };
      } else if (typeof body.message === 'string') {
        message = body.message;
      }

      if (typeof body.errorCode === 'string') {
        errorCode = body.errorCode;
      }
    }

    const payload: ApiErrorResponse = {
      success: false,
      errorCode,
      message,
      ...(details ? { details } : {}),
    };

    response.status(status).json(payload);
  }

  private deriveErrorCode(exception: HttpException, status: number): string {
    const derived = exception.constructor.name
      .replace(/Exception$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toUpperCase();
    return derived || `HTTP_${status}`;
  }
}
