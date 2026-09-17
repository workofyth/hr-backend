import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditLogService } from '../../common/services/audit-log.service';

/**
 * Modul tipis khusus untuk EXPOSE audit_logs sebagai endpoint read-only
 * (admin-dashboard-web-hr.md). `AuditLogService` sendiri sudah dipakai
 * (untuk `record()`) oleh AttendanceModule/LeaveModule/PayrollModule secara
 * independen — modul ini hanya menambahkan jalur baca, tidak mengambil
 * alih penulisan dari modul-modul tersebut.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditLogService],
})
export class AuditModule {}
