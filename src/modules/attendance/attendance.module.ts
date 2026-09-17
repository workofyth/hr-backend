import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeModule } from '../employee/employee.module';
import { EmployeeShiftAssignment } from '../employee/entities/employee-shift-assignment.entity';
import { attendanceEntities } from './entities';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceCorrectionRepository } from './attendance-correction.repository';
import { ATTENDANCE_CORRECTION_REPOSITORY, ATTENDANCE_REPOSITORY } from './attendance.constants';
import { GeofenceValidationStrategy } from './strategies/geofence-validation.strategy';
import { TRANSACTION_RUNNER, TypeOrmTransactionRunner } from '../../database/transaction-runner';

@Module({
  imports: [
    TypeOrmModule.forFeature([...attendanceEntities, EmployeeShiftAssignment]),
    // Untuk EMPLOYEE_REPOSITORY — AttendanceService perlu data cabang &
    // atasan karyawan (branch untuk geofence, managerId untuk approval
    // koreksi absensi).
    EmployeeModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    GeofenceValidationStrategy,
    { provide: ATTENDANCE_REPOSITORY, useClass: AttendanceRepository },
    { provide: ATTENDANCE_CORRECTION_REPOSITORY, useClass: AttendanceCorrectionRepository },
    { provide: TRANSACTION_RUNNER, useClass: TypeOrmTransactionRunner },
  ],
})
export class AttendanceModule {}
