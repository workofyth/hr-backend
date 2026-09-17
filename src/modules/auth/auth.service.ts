import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { comparePassword } from '../../common/utils/password.util';
import { USER_REPOSITORY } from './auth.constants';
import { IUserRepository } from './user-repository.interface';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User } from './entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: UserRole };
}

interface RefreshPayload {
  sub: string;
  role: UserRole;
}

/**
 * AuthService — login & refresh token (roadmap-aplikasi-hr.md Phase 1).
 * Tidak tahu detail HTTP (§1) — hanya menerima/mengembalikan DTO/data murni,
 * dan bergantung pada IUserRepository (Dependency Inversion, §3).
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.userRepository.findByEmailOrPhone(dto.emailOrPhone);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email/HP atau password salah');
    }

    const isPasswordValid = await comparePassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email/HP atau password salah');
    }

    await this.userRepository.updateLastLogin(user.id, new Date());

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid atau kedaluwarsa');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User tidak ditemukan atau nonaktif');
    }

    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
