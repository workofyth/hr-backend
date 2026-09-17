import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard autentikasi JWT — memvalidasi access token lewat JwtStrategy
 * (modules/auth/strategies/jwt.strategy.ts) dan mengisi `request.user`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
