import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeModule } from '../employee/employee.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { payrollEntities } from './entities';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { PAYROLL_REPOSITORY } from './payroll.constants';
import { OvertimeCalculator } from './calculators/overtime.calculator';
import { BpjsCalculator } from './calculators/bpjs.calculator';
import { Pph21Calculator } from './calculators/pph21.calculator';
import { ThrCalculator } from './calculators/thr.calculator';
import { MonthlySalaryPayrollCalculator } from './calculators/monthly-salary-payroll.calculator';
import { DailyWagePayrollCalculator } from './calculators/daily-wage-payroll.calculator';
import { PayrollCalculatorFactory } from './calculators/payroll-calculator.factory';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TRANSACTION_RUNNER, TypeOrmTransactionRunner } from '../../database/transaction-runner';

@Module({
  imports: [
    TypeOrmModule.forFeature([...payrollEntities, AuditLog]),
    // EMPLOYEE_REPOSITORY: daftar employee aktif per company + data PTKP
    // (maritalStatus/dependentsCount/joinDate/resignDate/employmentType).
    EmployeeModule,
    // ATTENDANCE_REPOSITORY: jam lembur (dari work_duration_minutes vs
    // jadwal shift) — lihat catatan di PayrollService.computeOvertimeHours.
    AttendanceModule,
    // LEAVE_REPOSITORY: hari unpaid leave untuk potongan gaji.
    LeaveModule,
  ],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    OvertimeCalculator,
    BpjsCalculator,
    Pph21Calculator,
    ThrCalculator,
    MonthlySalaryPayrollCalculator,
    DailyWagePayrollCalculator,
    PayrollCalculatorFactory,
    AuditLogService,
    { provide: PAYROLL_REPOSITORY, useClass: PayrollRepository },
    { provide: TRANSACTION_RUNNER, useClass: TypeOrmTransactionRunner },
  ],
})
export class PayrollModule {}
