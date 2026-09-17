import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { buildTypeOrmOptions } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
    // Admin Dashboard statis (public/admin/) — murni consumer REST API,
    // tidak ada logika bisnis di sini. Diserve di /admin, terpisah dari
    // prefix /api/v1.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public', 'admin'),
      serveRoot: '/admin',
    }),
    AuthModule,
    EmployeeModule,
    OrganizationModule,
    // Modul fitur lain (attendance, leave, payroll, notification) akan
    // didaftarkan di sini per fase sesuai roadmap-aplikasi-hr.md.
  ],
  controllers: [HealthController],
})
export class AppModule {}
