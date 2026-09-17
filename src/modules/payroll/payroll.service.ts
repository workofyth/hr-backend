import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYROLL_GENERATED_EVENT, PAYROLL_REPOSITORY } from './payroll.constants';
import { IPayrollRepository } from './payroll-repository.interface';
import { PayrollCalculatorFactory } from './calculators/payroll-calculator.factory';
import { ThrCalculator, ThrCalculationResult } from './calculators/thr.calculator';
import { PayrollPeriod, PayrollPeriodStatus } from './entities/payroll-period.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollItemDetail } from './entities/payroll-item-detail.entity';
import { SalaryComponentType } from './entities/salary-component.entity';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { AssignSalaryStructureDto } from './dto/assign-salary-structure.dto';
import { CreateBpjsSettingDto } from './dto/create-bpjs-setting.dto';
import { CreatePtkpSettingDto } from './dto/create-ptkp-setting.dto';
import { CreateTerRateDto } from './dto/create-ter-rate.dto';
import { SalaryComponent } from './entities/salary-component.entity';
import { EmployeeSalaryStructure } from './entities/employee-salary-structure.entity';
import { BpjsSetting } from './entities/bpjs-setting.entity';
import { TaxPtkpSetting } from './entities/tax-ptkp-setting.entity';
import { TaxTerRate } from './entities/tax-ter-rate.entity';
import { PayrollGeneratedEvent } from './events/payroll-generated.event';
import { EMPLOYEE_REPOSITORY } from '../employee/employee.constants';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { ATTENDANCE_REPOSITORY } from '../attendance/attendance.constants';
import { IAttendanceRepository } from '../attendance/attendance-repository.interface';
import { Shift } from '../../database/entities/shift.entity';
import { LEAVE_REPOSITORY } from '../leave/leave.constants';
import { ILeaveRepository } from '../leave/leave-repository.interface';
import { TRANSACTION_RUNNER, TransactionRunner } from '../../database/transaction-runner';
import { AuditLogService } from '../../common/services/audit-log.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { toDecimalString } from '../../common/utils/currency.util';

export interface PayrollPeriodDetail {
  period: PayrollPeriod;
  items: Array<PayrollItem & { details: PayrollItemDetail[] }>;
}

/**
 * Logika bisnis modul Payroll — roadmap-aplikasi-hr.md Phase 4, alur
 * generate di backend-architecture-hr.md §6:
 * "Ambil semua employee aktif -> Ambil data absensi & cuti periode ->
 * PayrollCalculatorFactory.getCalculator(employmentType) -> Hitung earning
 * -> BPJS -> PPh21 -> net -> Simpan payroll_items + payroll_item_details ->
 * Commit transaction, ubah status GENERATED -> Emit payroll.generated".
 * Bergantung pada interface repository (Dependency Inversion, §3) sehingga
 * bisa di-unit-test dengan mock repository, tanpa DB/HTTP server sungguhan.
 */
@Injectable()
export class PayrollService {
  constructor(
    @Inject(PAYROLL_REPOSITORY) private readonly payrollRepository: IPayrollRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: IEmployeeRepository,
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendanceRepository: IAttendanceRepository,
    @Inject(LEAVE_REPOSITORY) private readonly leaveRepository: ILeaveRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactionRunner: TransactionRunner,
    private readonly calculatorFactory: PayrollCalculatorFactory,
    private readonly thrCalculator: ThrCalculator,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate payroll_items untuk semua employee ACTIVE pada satu periode,
   * dibungkus SATU database transaction (Unit of Work, §3) — semua sukses
   * atau semua rollback. Idempotency (checklist §4): dijaga di level
   * `payroll_periods.status` (hanya bisa generate dari DRAFT) DAN
   * constraint UNIQUE(payroll_period_id, employee_id) di level DB sebagai
   * lapisan pertahanan kedua.
   */
  async generate(dto: GeneratePayrollDto): Promise<PayrollPeriod> {
    const period = await this.findOrCreateDraftPeriod(dto);
    if (period.status !== PayrollPeriodStatus.DRAFT) {
      throw new ConflictException(
        `Periode payroll ${dto.periodMonth}/${dto.periodYear} sudah pernah digenerate (status: ${period.status})`,
      );
    }

    const periodStartDate = this.formatPeriodDate(dto.periodYear, dto.periodMonth, 1);
    const lastDayOfMonth = new Date(dto.periodYear, dto.periodMonth, 0).getDate();
    const periodEndDate = this.formatPeriodDate(dto.periodYear, dto.periodMonth, lastDayOfMonth);
    const workingDaysInPeriod = this.countWorkingDaysInMonth(dto.periodYear, dto.periodMonth);

    const employees = await this.employeeRepository.findActiveByCompany(dto.companyId);

    return this.transactionRunner.run(async (manager) => {
      const createdItemIds: string[] = [];

      for (const employee of employees) {
        const salaryStructures = await this.payrollRepository.findActiveSalaryStructures(
          employee.id,
          periodEndDate,
        );
        // Karyawan tanpa struktur gaji terkonfigurasi dilewati (defensif) —
        // bukan tanggung jawab PayrollService untuk menebak gaji.
        if (salaryStructures.length === 0) continue;

        const unpaidLeaveDays = await this.computeUnpaidLeaveDays(employee.id, periodStartDate, periodEndDate);
        const overtimeHours = await this.computeOvertimeHours(employee.id, dto.periodMonth, dto.periodYear);

        const calculator = this.calculatorFactory.getCalculator(employee.employmentType);
        const result = await calculator.calculate({
          employee,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          periodStartDate,
          periodEndDate,
          workingDaysInPeriod,
          salaryStructures,
          unpaidLeaveDays,
          overtimeHours,
          isOvertimeOnHoliday: false,
        });

        const item = await this.payrollRepository.createItem(
          {
            payrollPeriodId: period.id,
            employeeId: employee.id,
            grossSalary: toDecimalString(result.grossSalary),
            totalOvertime: toDecimalString(result.totalOvertime),
            totalDeductionUnpaid: toDecimalString(result.totalDeductionUnpaid),
            bpjsCompanyTotal: toDecimalString(result.bpjsCompanyTotal),
            bpjsEmployeeTotal: toDecimalString(result.bpjsEmployeeTotal),
            pph21Amount: toDecimalString(result.pph21Amount),
            netSalary: toDecimalString(result.netSalary),
          },
          manager,
        );

        for (const detail of result.details) {
          await this.payrollRepository.createItemDetail(
            {
              payrollItemId: item.id,
              componentName: detail.componentName,
              componentType: detail.componentType,
              amount: toDecimalString(detail.amount),
            },
            manager,
          );
        }

        createdItemIds.push(item.id);
      }

      const generatedPeriod = await this.payrollRepository.updatePeriod(
        period.id,
        { status: PayrollPeriodStatus.GENERATED, generatedAt: new Date() },
        manager,
      );

      this.eventEmitter.emit(PAYROLL_GENERATED_EVENT, new PayrollGeneratedEvent(generatedPeriod.id, createdItemIds));

      return generatedPeriod;
    });
  }

  async approve(actingUser: AuthenticatedUser, periodId: string): Promise<PayrollPeriod> {
    const period = await this.payrollRepository.findPeriodById(periodId);
    if (!period) {
      throw new NotFoundException('Periode payroll tidak ditemukan');
    }
    if (period.status !== PayrollPeriodStatus.GENERATED) {
      throw new ConflictException('Periode payroll harus berstatus GENERATED sebelum disetujui');
    }

    const actingEmployee = await this.employeeRepository.findByUserId(actingUser.userId);
    if (!actingEmployee) {
      throw new NotFoundException('Data karyawan approver tidak ditemukan');
    }

    // payroll_periods + audit_logs — dua tabel, dibungkus satu transaction
    // (checklist §7: "Semua operasi multi-tabel dibungkus transaction").
    return this.transactionRunner.run(async (manager) => {
      const approved = await this.payrollRepository.updatePeriod(
        periodId,
        { status: PayrollPeriodStatus.APPROVED, approvedBy: actingEmployee.id },
        manager,
      );

      // Checklist §7: "Ada audit log untuk perubahan data gaji & approval".
      await this.auditLogService.record(
        {
          userId: actingUser.userId,
          action: 'APPROVE_PAYROLL',
          entityType: 'payroll_period',
          entityId: periodId,
          oldValue: { status: period.status },
          newValue: { status: PayrollPeriodStatus.APPROVED, approvedBy: actingEmployee.id },
        },
        manager,
      );

      return approved;
    });
  }

  /**
   * Perhitungan THR (roadmap Phase 4) — terpisah dari `generate()` bulanan
   * karena THR bukan bagian dari alur payroll periodik (§6), dibayarkan
   * sekali per tahun menjelang hari raya. Basis THR = gaji pokok +
   * tunjangan TETAP saja (Permenaker 6/2016 — tunjangan tidak tetap
   * dikecualikan).
   */
  async calculateThr(employeeId: string, referenceDate: string): Promise<ThrCalculationResult> {
    const employee = await this.employeeRepository.findById(employeeId);
    if (!employee) {
      throw new NotFoundException('Karyawan tidak ditemukan');
    }

    const salaryStructures = await this.payrollRepository.findActiveSalaryStructures(employeeId, referenceDate);
    const monthlySalary = salaryStructures
      .filter((s) => s.salaryComponent.type === SalaryComponentType.EARNING && s.salaryComponent.isFixed)
      .reduce((sum, s) => sum + Number(s.amount), 0);

    return this.thrCalculator.calculate({ monthlySalary, joinDate: employee.joinDate, referenceDate });
  }

  async findDetail(periodId: string): Promise<PayrollPeriodDetail> {
    const period = await this.payrollRepository.findPeriodById(periodId);
    if (!period) {
      throw new NotFoundException('Periode payroll tidak ditemukan');
    }

    const items = await this.payrollRepository.findItemsByPeriod(periodId);
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => ({ ...item, details: await this.payrollRepository.findItemDetails(item.id) })),
    );

    return { period, items: itemsWithDetails };
  }

  // ---------------------------------------------------------------------
  // Pengaturan payroll (salary_components, employee_salary_structures,
  // bpjs_settings, tax_ptkp_settings, tax_ter_rates) — admin-dashboard-web-hr.md
  // §5: "Halaman terpisah untuk konfigurasi ... histori per tanggal
  // berlaku, TIDAK BOLEH edit langsung angka yang sudah dipakai payroll
  // periode lampau (harus buat entry baru dengan effective_date baru)".
  // Karena itu seluruh method di bawah ini CREATE-ONLY (tidak ada
  // update/delete) — konsisten dengan checklist §8 dashboard.
  // ---------------------------------------------------------------------

  findSalaryComponents(companyId: string): Promise<SalaryComponent[]> {
    return this.payrollRepository.findSalaryComponents(companyId);
  }

  createSalaryComponent(dto: CreateSalaryComponentDto): Promise<SalaryComponent> {
    return this.payrollRepository.createSalaryComponent(dto);
  }

  findSalaryStructures(employeeId: string): Promise<EmployeeSalaryStructure[]> {
    return this.payrollRepository.findSalaryStructuresByEmployee(employeeId);
  }

  /**
   * Assign komponen gaji ke karyawan. Kalau employee+component yang sama
   * masih punya entry TERBUKA (endDate null), entry lama itu ditutup
   * (endDate = sehari sebelum effectiveDate baru) DALAM transaction yang
   * sama — bukan overwrite, dan mencegah dua entry aktif tumpang tindih
   * yang akan membuat MonthlySalaryPayrollCalculator menghitung dobel.
   */
  async assignSalaryStructure(dto: AssignSalaryStructureDto): Promise<EmployeeSalaryStructure> {
    const openEntry = await this.payrollRepository.findOpenSalaryStructure(dto.employeeId, dto.salaryComponentId);
    const data = {
      employeeId: dto.employeeId,
      salaryComponentId: dto.salaryComponentId,
      amount: toDecimalString(dto.amount),
      effectiveDate: dto.effectiveDate,
    };

    if (openEntry) {
      const dayBeforeNew = this.subtractOneDay(dto.effectiveDate);
      if (dayBeforeNew < openEntry.effectiveDate) {
        throw new BadRequestException(
          'effectiveDate harus setelah tanggal mulai entry yang sedang aktif untuk komponen ini',
        );
      }

      return this.transactionRunner.run(async (manager) => {
        await this.payrollRepository.closeSalaryStructure(openEntry.id, dayBeforeNew, manager);
        return this.payrollRepository.createSalaryStructure(data, manager);
      });
    }

    return this.payrollRepository.createSalaryStructure(data);
  }

  findAllBpjsSettings(): Promise<BpjsSetting[]> {
    return this.payrollRepository.findAllBpjsSettings();
  }

  createBpjsSetting(dto: CreateBpjsSettingDto): Promise<BpjsSetting> {
    return this.payrollRepository.createBpjsSetting({
      type: dto.type,
      companyPercentage: dto.companyPercentage.toFixed(4),
      employeePercentage: dto.employeePercentage.toFixed(4),
      maxSalaryBase: dto.maxSalaryBase !== undefined ? toDecimalString(dto.maxSalaryBase) : null,
      effectiveDate: dto.effectiveDate,
    });
  }

  findAllPtkpSettings(): Promise<TaxPtkpSetting[]> {
    return this.payrollRepository.findAllPtkpSettings();
  }

  createPtkpSetting(dto: CreatePtkpSettingDto): Promise<TaxPtkpSetting> {
    return this.payrollRepository.createPtkpSetting({
      status: dto.status,
      annualAmount: toDecimalString(dto.annualAmount),
      effectiveYear: dto.effectiveYear,
    });
  }

  findAllTerRates(): Promise<TaxTerRate[]> {
    return this.payrollRepository.findAllTerRates();
  }

  createTerRate(dto: CreateTerRateDto): Promise<TaxTerRate> {
    return this.payrollRepository.createTerRate({
      category: dto.category,
      incomeFrom: toDecimalString(dto.incomeFrom),
      incomeTo: toDecimalString(dto.incomeTo),
      rate: dto.rate.toFixed(4),
      effectiveYear: dto.effectiveYear,
    });
  }

  // ---------------------------------------------------------------------
  // Helper privat
  // ---------------------------------------------------------------------

  private async findOrCreateDraftPeriod(dto: GeneratePayrollDto): Promise<PayrollPeriod> {
    const existing = await this.payrollRepository.findPeriod(dto.companyId, dto.periodMonth, dto.periodYear);
    if (existing) return existing;

    return this.payrollRepository.createPeriod({
      companyId: dto.companyId,
      periodMonth: dto.periodMonth,
      periodYear: dto.periodYear,
      status: PayrollPeriodStatus.DRAFT,
    });
  }

  private formatPeriodDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private subtractOneDay(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Hari kerja acuan sebulan — asumsi 6 hari kerja/minggu (Senin-Sabtu),
   * hari libur nasional (`holidays`) BELUM dikecualikan dari pembagi ini
   * pada fase ini (penyederhanaan yang didokumentasikan, bukan tersembunyi).
   */
  private countWorkingDaysInMonth(year: number, month: number): number {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if (dayOfWeek !== 0) workingDays++;
    }
    return workingDays;
  }

  private countInclusiveDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  /**
   * Potongan unpaid leave (roadmap Phase 4) — hanya menghitung hari dari
   * `leave_requests` APPROVED yang jenis cutinya `is_paid = false`,
   * dipotong ke rentang periode payroll (leave bisa melintasi batas bulan).
   */
  private async computeUnpaidLeaveDays(
    employeeId: string,
    periodStartDate: string,
    periodEndDate: string,
  ): Promise<number> {
    const requests = await this.leaveRepository.findApprovedRequestsOverlapping(
      employeeId,
      periodStartDate,
      periodEndDate,
    );

    let totalDays = 0;
    for (const request of requests) {
      if (request.leaveType?.isPaid) continue;
      const overlapStart = request.startDate > periodStartDate ? request.startDate : periodStartDate;
      const overlapEnd = request.endDate < periodEndDate ? request.endDate : periodEndDate;
      totalDays += this.countInclusiveDays(overlapStart, overlapEnd);
    }
    return totalDays;
  }

  /**
   * Jam lembur (roadmap Phase 4) — diturunkan dari kelebihan
   * `attendances.work_duration_minutes` terhadap jadwal shift, BUKAN dari
   * tabel `overtime_requests` (§5.3) yang didokumentasikan di roadmap Phase
   * 2 namun belum pernah dibuat/diimplementasikan di modul Attendance.
   * Ini adalah penyederhanaan yang disengaja & didokumentasikan — belum ada
   * alur pengajuan/approval lembur terpisah pada fase ini.
   */
  private async computeOvertimeHours(employeeId: string, month: number, year: number): Promise<number> {
    const { items } = await this.attendanceRepository.findHistory({ employeeId, page: 1, limit: 31, month, year });

    let totalOvertimeMinutes = 0;
    for (const attendance of items) {
      if (!attendance.workDurationMinutes || !attendance.shift) continue;
      const scheduledMinutes = this.scheduledShiftMinutes(attendance.shift);
      const overtimeMinutes = attendance.workDurationMinutes - scheduledMinutes;
      if (overtimeMinutes > 0) totalOvertimeMinutes += overtimeMinutes;
    }

    return Math.round((totalOvertimeMinutes / 60) * 100) / 100;
  }

  private scheduledShiftMinutes(shift: Shift): number {
    return this.parseTimeToMinutes(shift.endTime) - this.parseTimeToMinutes(shift.startTime);
  }

  private parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
