import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { buildTypeOrmOptions } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationModule } from './modules/notification/notification.module';
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
    // Observer/Event-driven (§3): dipakai AttendanceService untuk emit
    // 'attendance.checked_in' tanpa bergantung langsung pada NotificationService.
    EventEmitterModule.forRoot(),
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
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    ReportsModule,
    NotificationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
