import { ConfigService } from '@nestjs/config';

/**
 * Opsi JWT access token, dibaca dari env (tidak ada secret hardcode).
 * Dipakai oleh AuthModule (JwtModule.registerAsync) mulai Phase 1 — Autentikasi.
 * Belum di-wire ke module manapun pada tahap fondasi ini.
 */
export function buildJwtAccessOptions(config: ConfigService) {
  return {
    secret: config.get<string>('jwt.accessSecret'),
    signOptions: { expiresIn: config.get<string>('jwt.accessExpiresIn') },
  };
}

export function buildJwtRefreshOptions(config: ConfigService) {
  return {
    secret: config.get<string>('jwt.refreshSecret'),
    signOptions: { expiresIn: config.get<string>('jwt.refreshExpiresIn') },
  };
}
