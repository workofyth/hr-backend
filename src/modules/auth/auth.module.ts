import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildJwtAccessOptions } from '../../config/jwt.config';
import { User } from './entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { USER_REPOSITORY } from './auth.constants';
import { UserRepository } from './user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: buildJwtAccessOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: UserRepository },
  ],
  // USER_REPOSITORY diekspor supaya EmployeeModule bisa membuat akun login
  // karyawan baru tanpa mengakses tabel `users` langsung (Repository Pattern).
  exports: [USER_REPOSITORY],
})
export class AuthModule {}
