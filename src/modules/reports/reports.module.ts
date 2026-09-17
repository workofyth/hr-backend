import { Module } from '@nestjs/common';
import { EmployeeModule } from '../employee/employee.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { PayrollModule } from '../payroll/payroll.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Modul Reports (roadmap Phase 5) — TANPA entity/repository sendiri.
 * ReportsService murni mengagregasi data lintas modul lewat
 * EMPLOYEE_REPOSITORY/ATTENDANCE_REPOSITORY/LEAVE_REPOSITORY/
 * PAYROLL_REPOSITORY yang sudah diekspor masing-masing modul — konsisten
 * dengan cara PayrollModule membaca data Attendance/Leave (§3 Dependency
 * Inversion), bukan lapisan baru yang mengakses tabel langsung.
 */
@Module({
  imports: [EmployeeModule, AttendanceModule, LeaveModule, PayrollModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
