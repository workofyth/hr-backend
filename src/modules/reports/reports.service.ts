import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EMPLOYEE_REPOSITORY } from '../employee/employee.constants';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { ATTENDANCE_REPOSITORY } from '../attendance/attendance.constants';
import { IAttendanceRepository, AttendanceStatusCounts } from '../attendance/attendance-repository.interface';
import { LEAVE_REPOSITORY } from '../leave/leave.constants';
import { ILeaveRepository } from '../leave/leave-repository.interface';
import { LeaveRequestStatus } from '../leave/entities/leave-request.entity';
import { PAYROLL_REPOSITORY } from '../payroll/payroll.constants';
import { IPayrollRepository } from '../payroll/payroll-repository.interface';
import { PayrollPeriodStatus } from '../payroll/entities/payroll-period.entity';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { LeaveSummaryQueryDto } from './dto/leave-summary-query.dto';
import { PayrollSummaryQueryDto } from './dto/payroll-summary-query.dto';
import { parseDecimal } from '../../common/utils/currency.util';

export interface EmployeeAttendanceSummary {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  branchName: string;
  departmentName: string;
  counts: AttendanceStatusCounts;
}

export interface EmployeeLeaveSummary {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  leaveTypeName: string;
  entitledDays: number;
  usedDays: number;
  carriedOverDays: number;
  remainingDays: number;
  pendingRequestCount: number;
}

export interface PayrollSummaryReport {
  payrollPeriodId: string;
  periodMonth: number;
  periodYear: number;
  status: PayrollPeriodStatus;
  employeeCount: number;
  totalGrossSalary: number;
  totalOvertime: number;
  totalDeductionUnpaid: number;
  totalBpjsCompany: number;
  totalBpjsEmployee: number;
  totalPph21: number;
  totalNetSalary: number;
}

/**
 * Logika bisnis modul Reports — roadmap-aplikasi-hr.md Phase 5. TIDAK
 * mengakses tabel attendances/leave_requests/payroll_items langsung —
 * seluruh baca lewat ATTENDANCE_REPOSITORY/LEAVE_REPOSITORY/PAYROLL_REPOSITORY/
 * EMPLOYEE_REPOSITORY yang sudah diekspor modul masing-masing (Repository
 * Pattern & Dependency Inversion, §3), sama seperti PayrollService membaca
 * data Attendance/Leave lintas modul.
 *
 * Query per-karyawan (bukan satu query GROUP BY lintas company) dipilih
 * SENGAJA untuk attendance & leave supaya setiap query benar-benar
 * memanfaatkan composite index yang didokumentasikan di §5 "Indexing
 * penting" — `(employee_id, attendance_date)` dan `(employee_id, status)`
 * — bukan full/partial scan lintas seluruh company. Untuk company yang
 * jauh lebih besar, langkah berikutnya adalah tabel agregat/materialized
 * view — di luar cakupan skema §5.5 saat ini, TIDAK ditambahkan di sini.
 */
@Injectable()
export class ReportsService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: IEmployeeRepository,
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendanceRepository: IAttendanceRepository,
    @Inject(LEAVE_REPOSITORY) private readonly leaveRepository: ILeaveRepository,
    @Inject(PAYROLL_REPOSITORY) private readonly payrollRepository: IPayrollRepository,
  ) {}

  /**
   * Laporan absensi per karyawan (roadmap Phase 5). Query
   * `countStatusesByEmployee` per karyawan memanfaatkan index
   * `(employee_id, attendance_date)`.
   */
  async getAttendanceSummary(query: AttendanceSummaryQueryDto): Promise<EmployeeAttendanceSummary[]> {
    const employees = await this.employeeRepository.findActiveByCompany(
      query.companyId,
      query.branchId,
      query.departmentId,
    );

    const startDate = this.formatDate(query.year, query.month, 1);
    const lastDay = new Date(query.year, query.month, 0).getDate();
    const endDate = this.formatDate(query.year, query.month, lastDay);

    return Promise.all(
      employees.map(async (employee) => ({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        branchName: employee.branch?.name ?? '-',
        departmentName: employee.department?.name ?? '-',
        counts: await this.attendanceRepository.countStatusesByEmployee(employee.id, startDate, endDate),
      })),
    );
  }

  /**
   * Laporan cuti — saldo, penggunaan, sisa cuti (roadmap Phase 5). Saldo
   * dibaca dari `leave_balances` (dipelihara akurat oleh LeaveService saat
   * approve/reject/cancel — lihat Phase 3), jumlah pengajuan PENDING
   * memanfaatkan index `(employee_id, status)`.
   */
  async getLeaveSummary(query: LeaveSummaryQueryDto): Promise<EmployeeLeaveSummary[]> {
    const employees = await this.employeeRepository.findActiveByCompany(
      query.companyId,
      query.branchId,
      query.departmentId,
    );

    const summaries: EmployeeLeaveSummary[] = [];
    for (const employee of employees) {
      const [balances, pendingRequestCount] = await Promise.all([
        this.leaveRepository.findBalancesByEmployee(employee.id, query.year),
        this.leaveRepository.countByEmployeeAndStatus(employee.id, LeaveRequestStatus.PENDING),
      ]);

      for (const balance of balances) {
        const entitledDays = parseDecimal(balance.entitledDays);
        const usedDays = parseDecimal(balance.usedDays);
        const carriedOverDays = parseDecimal(balance.carriedOverDays);

        summaries.push({
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          leaveTypeName: balance.leaveType.name,
          entitledDays,
          usedDays,
          carriedOverDays,
          remainingDays: entitledDays + carriedOverDays - usedDays,
          pendingRequestCount,
        });
      }
    }

    return summaries;
  }

  /**
   * Laporan payroll — rekap gaji, PPh 21, BPJS, "siap lapor ke instansi
   * terkait" (roadmap Phase 5). Satu query `findItemsByPeriod` yang
   * memanfaatkan index `(payroll_period_id)`, dijumlahkan di service layer.
   */
  async getPayrollSummary(query: PayrollSummaryQueryDto): Promise<PayrollSummaryReport> {
    const period = await this.payrollRepository.findPeriod(query.companyId, query.periodMonth, query.periodYear);
    if (!period) {
      throw new NotFoundException(`Periode payroll ${query.periodMonth}/${query.periodYear} tidak ditemukan`);
    }

    const items = await this.payrollRepository.findItemsByPeriod(period.id);

    const totals = items.reduce(
      (acc, item) => ({
        totalGrossSalary: acc.totalGrossSalary + parseDecimal(item.grossSalary),
        totalOvertime: acc.totalOvertime + parseDecimal(item.totalOvertime),
        totalDeductionUnpaid: acc.totalDeductionUnpaid + parseDecimal(item.totalDeductionUnpaid),
        totalBpjsCompany: acc.totalBpjsCompany + parseDecimal(item.bpjsCompanyTotal),
        totalBpjsEmployee: acc.totalBpjsEmployee + parseDecimal(item.bpjsEmployeeTotal),
        totalPph21: acc.totalPph21 + parseDecimal(item.pph21Amount),
        totalNetSalary: acc.totalNetSalary + parseDecimal(item.netSalary),
      }),
      {
        totalGrossSalary: 0,
        totalOvertime: 0,
        totalDeductionUnpaid: 0,
        totalBpjsCompany: 0,
        totalBpjsEmployee: 0,
        totalPph21: 0,
        totalNetSalary: 0,
      },
    );

    return {
      payrollPeriodId: period.id,
      periodMonth: period.periodMonth,
      periodYear: period.periodYear,
      status: period.status,
      employeeCount: items.length,
      ...totals,
    };
  }

  private formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
