import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../../../common/enums/user-role.enum';

export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

/**
 * Strategy Pattern (Passport) untuk validasi access token JWT.
 * Hasil `validate()` diisi ke `request.user`, dipakai RolesGuard.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    return { userId: payload.sub, role: payload.role };
  }
}
