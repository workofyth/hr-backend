import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

interface ShapedResult<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

function isShapedResult<T>(value: unknown): value is ShapedResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Object.keys(value).every((key) => ['data', 'message', 'meta'].includes(key))
  );
}

/**
 * Bungkus semua response sukses ke format standar
 * { success, data, message, meta } — backend-architecture-hr.md §4.
 * Controller/Service boleh mengembalikan data mentah (dibungkus otomatis
 * sebagai `data`) atau bentuk { data, message?, meta? } untuk kasus
 * pagination/pesan kustom.
 */
@Injectable()
export class ResponseTransformerInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (isShapedResult<T>(result)) {
          return {
            success: true as const,
            data: result.data,
            ...(result.message ? { message: result.message } : {}),
            ...(result.meta ? { meta: result.meta } : {}),
          };
        }
        return { success: true as const, data: result };
      }),
    );
  }
}
