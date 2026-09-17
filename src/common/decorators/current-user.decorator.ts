import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Ambil `request.user` (diisi JwtStrategy lewat JwtAuthGuard) — dipakai
 * endpoint self-service (mis. check-in/check-out) yang beraksi atas nama
 * user yang sedang login, bukan target dari path/body.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
