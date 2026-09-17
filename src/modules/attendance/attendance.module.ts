import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeModule } from '../employee/employee.module';
import { EmployeeShiftAssignment } from '../employee/entities/employee-shift-assignment.entity';
import { attendanceEntities } from './entities';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceCorrectionRepository } from './attendance-correction.repository';
import { OvertimeRequestRepository } from './overtime-request.repository';
import {
  ATTENDANCE_CORRECTION_REPOSITORY,
  ATTENDANCE_REPOSITORY,
  OVERTIME_REQUEST_REPOSITORY,
} from './attendance.constants';
import { GeofenceValidationStrategy } from './strategies/geofence-validation.strategy';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TRANSACTION_RUNNER, TypeOrmTransactionRunner } from '../../database/transaction-runner';

@Module({
  imports: [
    TypeOrmModule.forFeature([...attendanceEntities, EmployeeShiftAssignment, AuditLog]),
    // Untuk EMPLOYEE_REPOSITORY — AttendanceService perlu data cabang &
    // atasan karyawan (branch untuk geofence, managerId untuk approval
    // koreksi absensi).
    EmployeeModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    GeofenceValidationStrategy,
    AuditLogService,
    { provide: ATTENDANCE_REPOSITORY, useClass: AttendanceRepository },
    { provide: ATTENDANCE_CORRECTION_REPOSITORY, useClass: AttendanceCorrectionRepository },
    { provide: OVERTIME_REQUEST_REPOSITORY, useClass: OvertimeRequestRepository },
    { provide: TRANSACTION_RUNNER, useClass: TypeOrmTransactionRunner },
  ],
  // ATTENDANCE_REPOSITORY & OVERTIME_REQUEST_REPOSITORY diekspor supaya
  // modul lain (payroll — jam lembur & potongan alpha, roadmap Phase 4)
  // bisa membaca attendances/overtime_requests tanpa mengakses tabelnya
  // langsung (Repository Pattern, §3).
  exports: [ATTENDANCE_REPOSITORY, OVERTIME_REQUEST_REPOSITORY],
})
export class AttendanceModule {}
