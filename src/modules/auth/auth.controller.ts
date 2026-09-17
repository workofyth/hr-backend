import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

/**
 * Batas login lebih ketat dari limit global (roadmap Phase 6 "Keamanan") —
 * mitigasi brute-force password. Angka ini konstanta keamanan operasional,
 * BUKAN tarif/rate bisnis (§5.5) — sengaja tidak lewat tabel/env, beda
 * kategori dari "jangan hardcode tarif BPJS/PTKP/TER" di checklist §7.
 */
const LOGIN_THROTTLE = { default: { limit: 5, ttl: seconds(60) } };

/**
 * Hanya menerima request & memanggil AuthService — tidak ada logika bisnis
 * di sini (checklist §7 backend-architecture-hr.md).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle(LOGIN_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }
}
