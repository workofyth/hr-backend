import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayrollService } from './payroll.service';
import { IPayrollRepository } from './payroll-repository.interface';
import { PayrollCalculatorFactory } from './calculators/payroll-calculator.factory';
import { MonthlySalaryPayrollCalculator } from './calculators/monthly-salary-payroll.calculator';
import { DailyWagePayrollCalculator } from './calculators/daily-wage-payroll.calculator';
import { OvertimeCalculator } from './calculators/overtime.calculator';
import { BpjsCalculator } from './calculators/bpjs.calculator';
import { Pph21Calculator } from './calculators/pph21.calculator';
import { ThrCalculator } from './calculators/thr.calculator';
import { PayrollPeriod, PayrollPeriodStatus } from './entities/payroll-period.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { BpjsSetting, BpjsType } from './entities/bpjs-setting.entity';
import { TaxPtkpSetting } from './entities/tax-ptkp-setting.entity';
import { TaxTerRate } from './entities/tax-ter-rate.entity';
import { EmployeeSalaryStructure } from './entities/employee-salary-structure.entity';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { Employee, EmploymentType, MaritalStatus } from '../employee/entities/employee.entity';
import { IOvertimeRequestRepository } from '../attendance/overtime-request-repository.interface';
import { OvertimeRequest } from '../attendance/entities/overtime-request.entity';
import { ILeaveRepository } from '../leave/leave-repository.interface';
import { LeaveRequest, LeaveRequestStatus } from '../leave/entities/leave-request.entity';
import { TransactionRunner } from '../../database/transaction-runner';
import { AuditLogService } from '../../common/services/audit-log.service';

describe('PayrollService.generate — 3 skenario wajib (angka manual sebagai pembanding)', () => {
  let service: PayrollService;
  let payrollRepository: jest.Mocked<IPayrollRepository>;
  let employeeRepository: jest.Mocked<IEmployeeRepository>;
  let overtimeRequestRepository: jest.Mocked<IOvertimeRequestRepository>;
  let leaveRepository: jest.Mocked<ILeaveRepository>;
  let transactionRunner: TransactionRunner;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let auditLogService: jest.Mocked<AuditLogService>;

  // Periode Juni 2026: 30 hari kalender, 4 hari Minggu -> 26 hari kerja
  // (dihitung ulang & diverifikasi manual via kalender sungguhan).
  const PERIOD_MONTH = 6;
  const PERIOD_YEAR = 2026;

  const bpjsSettings = [
    { type: BpjsType.JHT, companyPercentage: '0.0370', employeePercentage: '0.0200', maxSalaryBase: null },
    { type: BpjsType.JKK, companyPercentage: '0.0024', employeePercentage: '0.0000', maxSalaryBase: null },
    { type: BpjsType.JKM, companyPercentage: '0.0030', employeePercentage: '0.0000', maxSalaryBase: null },
    { type: BpjsType.JP, companyPercentage: '0.0200', employeePercentage: '0.0100', maxSalaryBase: '10000000.00' },
    {
      type: BpjsType.KESEHATAN,
      companyPercentage: '0.0400',
      employeePercentage: '0.0100',
      maxSalaryBase: '12000000.00',
    },
  ] as unknown as BpjsSetting[];

  function makeEmployee(): Employee {
    return {
      id: 'employee-1',
      companyId: 'company-1',
      employmentType: EmploymentType.PKWTT,
      joinDate: '2020-01-01', // jauh sebelum periode -> tidak ada prorata masa kerja
      resignDate: null,
      maritalStatus: MaritalStatus.TK,
      dependentsCount: 0, // -> PTKP TK0 -> kategori TER A
    } as unknown as Employee;
  }

  function makeSalaryStructure(name: string, amount: string, isFixed: boolean): EmployeeSalaryStructure {
    return {
      amount,
      salaryComponent: { name, type: 'EARNING', isFixed },
    } as unknown as EmployeeSalaryStructure;
  }

  beforeEach(() => {
    payrollRepository = {
      findSalaryComponents: jest.fn(),
      createSalaryComponent: jest.fn(),
      findActiveSalaryStructures: jest.fn(),
      findSalaryStructuresByEmployee: jest.fn(),
      findOpenSalaryStructure: jest.fn(),
      createSalaryStructure: jest.fn(),
      closeSalaryStructure: jest.fn(),
      findAllBpjsSettings: jest.fn(),
      createBpjsSetting: jest.fn(),
      findAllPtkpSettings: jest.fn(),
      createPtkpSetting: jest.fn(),
      findAllTerRates: jest.fn(),
      createTerRate: jest.fn(),
      findActiveBpjsSettings: jest.fn().mockResolvedValue(bpjsSettings),
      findPtkpSetting: jest.fn().mockResolvedValue({ status: 'TK0' } as TaxPtkpSetting),
      findTerRate: jest.fn().mockResolvedValue({ category: 'A', rate: '0.0200' } as TaxTerRate),
      findPeriodById: jest.fn(),
      findPeriods: jest.fn(),
      findPeriod: jest.fn().mockResolvedValue(null),
      createPeriod: jest.fn().mockImplementation((data) =>
        Promise.resolve({ id: 'period-1', status: PayrollPeriodStatus.DRAFT, ...data } as PayrollPeriod),
      ),
      updatePeriod: jest.fn().mockImplementation((id, data) =>
        Promise.resolve({ id, ...data } as PayrollPeriod),
      ),
      findItemsByPeriod: jest.fn(),
      createItem: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'item-1', ...data } as PayrollItem)),
      findItemDetails: jest.fn(),
      createItemDetail: jest.fn().mockResolvedValue({}),
    };

    employeeRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByEmployeeCode: jest.fn(),
      findFirstByCompanyAndRole: jest.fn(),
      findActiveByCompany: jest.fn().mockResolvedValue([makeEmployee()]),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    overtimeRequestRepository = {
      findById: jest.fn(),
      findByStatus: jest.fn(),
      findApprovedByEmployeeAndDateRange: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    };

    leaveRepository = {
      findLeaveTypeById: jest.fn(),
      findAllLeaveTypes: jest.fn(),
      findBalance: jest.fn(),
      findBalancesByEmployee: jest.fn(),
      updateBalance: jest.fn(),
      findRequestById: jest.fn(),
      findRequestsByEmployee: jest.fn(),
      findApprovedRequestsOverlapping: jest.fn().mockResolvedValue([]),
      createRequest: jest.fn(),
      updateRequest: jest.fn(),
      findApprovalsByRequestId: jest.fn(),
      createApproval: jest.fn(),
      updateApproval: jest.fn(),
      countByEmployeeAndStatus: jest.fn(),
      findActionableApprovals: jest.fn(),
    };

    const runMock = jest.fn((work: (manager: never) => Promise<unknown>) => work(undefined as never));
    transactionRunner = { run: runMock } as unknown as TransactionRunner;
    eventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;

    // Wiring PRODUKSI sungguhan (bukan mock) untuk seluruh rantai calculator
    // — supaya angka yang diverifikasi manual di setiap skenario benar-benar
    // hasil kode yang sama dipakai PayrollService, bukan nilai yang di-stub.
    const overtimeCalculator = new OvertimeCalculator();
    const bpjsCalculator = new BpjsCalculator(payrollRepository);
    const pph21Calculator = new Pph21Calculator(payrollRepository);
    const monthlyCalculator = new MonthlySalaryPayrollCalculator(overtimeCalculator, bpjsCalculator, pph21Calculator);
    const dailyCalculator = new DailyWagePayrollCalculator(overtimeCalculator, bpjsCalculator, pph21Calculator);
    const calculatorFactory = new PayrollCalculatorFactory(monthlyCalculator, dailyCalculator);
    const thrCalculator = new ThrCalculator();
    auditLogService = { record: jest.fn() } as unknown as jest.Mocked<AuditLogService>;

    service = new PayrollService(
      payrollRepository,
      employeeRepository,
      overtimeRequestRepository,
      leaveRepository,
      transactionRunner,
      calculatorFactory,
      thrCalculator,
      auditLogService,
      eventEmitter,
    );
  });

  it('Skenario 1 — karyawan tetap gaji standar (tanpa lembur/unpaid leave)', async () => {
    payrollRepository.findActiveSalaryStructures.mockResolvedValue([
      makeSalaryStructure('Gaji Pokok', '6000000.00', true),
    ]);

    await service.generate({ companyId: 'company-1', periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    // Gross = 6.000.000 (tanpa lembur). BPJS basis 6.000.000:
    //   JHT 3.7%/2%=222.000/120.000 | JKK 0.24%=14.400/0 | JKM 0.3%=18.000/0
    //   JP 2%/1%=120.000/60.000     | KESEHATAN 4%/1%=240.000/60.000
    //   totalCompany=222000+14400+18000+120000+240000=614.400
    //   totalEmployee=120000+60000+60000=240.000
    // PPh21 (TER A, rate mock 2%) = 6.000.000 x 2% = 120.000
    // Net = 6.000.000 - 0(unpaid) - 240.000(bpjs) - 120.000(pph21) = 5.640.000
    expect(payrollRepository.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'employee-1',
        grossSalary: '6000000.00',
        totalOvertime: '0.00',
        totalDeductionUnpaid: '0.00',
        bpjsCompanyTotal: '614400.00',
        bpjsEmployeeTotal: '240000.00',
        pph21Amount: '120000.00',
        netSalary: '5640000.00',
      }),
      undefined,
    );
  });

  it('Skenario 2 — karyawan dengan lembur 3 jam hari kerja biasa', async () => {
    payrollRepository.findActiveSalaryStructures.mockResolvedValue([
      makeSalaryStructure('Gaji Pokok', '3460000.00', true), // 3.460.000/173 = 20.000 tepat
      makeSalaryStructure('Tunjangan Transport', '500000.00', false),
    ]);
    // 1 pengajuan lembur APPROVED: 17:00-20:00 = 180 menit = 3 jam.
    overtimeRequestRepository.findApprovedByEmployeeAndDateRange.mockResolvedValue([
      {
        startTime: new Date('2026-06-15T17:00:00Z'),
        endTime: new Date('2026-06-15T20:00:00Z'),
      } as unknown as OvertimeRequest,
    ]);

    await service.generate({ companyId: 'company-1', periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    // nominalGrossSalary = 3.460.000 + 500.000 = 3.960.000
    // Lembur: 3 jam hari biasa = 1*1.5*20.000 + 2*2*20.000 = 30.000+80.000 = 110.000
    // Gross = 3.960.000 + 110.000 = 4.070.000
    // BPJS basis 4.070.000: JHT 150.590/81.400 | JKK 9.768/0 | JKM 12.210/0
    //   JP 81.400/40.700 | KESEHATAN 162.800/40.700
    //   totalCompany=150590+9768+12210+81400+162800=416.768
    //   totalEmployee=81400+40700+40700=162.800
    // PPh21 = 4.070.000 x 2% = 81.400
    // Net = 4.070.000 - 0 - 162.800 - 81.400 = 3.825.800
    expect(payrollRepository.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        grossSalary: '4070000.00',
        totalOvertime: '110000.00',
        totalDeductionUnpaid: '0.00',
        bpjsCompanyTotal: '416768.00',
        bpjsEmployeeTotal: '162800.00',
        pph21Amount: '81400.00',
        netSalary: '3825800.00',
      }),
      undefined,
    );
  });

  it('Skenario 3 — karyawan dengan 3 hari unpaid leave', async () => {
    payrollRepository.findActiveSalaryStructures.mockResolvedValue([
      makeSalaryStructure('Gaji Pokok', '5200000.00', true), // 5.200.000/26 hari kerja = 200.000/hari tepat
    ]);
    leaveRepository.findApprovedRequestsOverlapping.mockResolvedValue([
      {
        employeeId: 'employee-1',
        status: LeaveRequestStatus.APPROVED,
        startDate: '2026-06-10',
        endDate: '2026-06-12', // 3 hari inklusif, seluruhnya di dalam periode
        leaveType: { isPaid: false },
      } as unknown as LeaveRequest,
    ]);

    await service.generate({ companyId: 'company-1', periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    // nominalGrossSalary = 5.200.000; dailyRate = 5.200.000/26 = 200.000
    // totalDeductionUnpaid = 200.000 x 3 hari = 600.000
    // Gross (kolom) = 5.200.000 (belum dikurangi unpaid, sesuai skema §5.5)
    // taxableBase = 5.200.000 - 600.000 = 4.600.000
    // BPJS basis 4.600.000: JHT 170.200/92.000 | JKK 11.040/0 | JKM 13.800/0
    //   JP 92.000/46.000 | KESEHATAN 184.000/46.000
    //   totalCompany=170200+11040+13800+92000+184000=471.040
    //   totalEmployee=92000+46000+46000=184.000
    // PPh21 = 4.600.000 x 2% = 92.000
    // Net = 5.200.000 - 600.000(unpaid) - 184.000(bpjs) - 92.000(pph21) = 4.324.000
    expect(payrollRepository.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        grossSalary: '5200000.00',
        totalOvertime: '0.00',
        totalDeductionUnpaid: '600000.00',
        bpjsCompanyTotal: '471040.00',
        bpjsEmployeeTotal: '184000.00',
        pph21Amount: '92000.00',
        netSalary: '4324000.00',
      }),
      undefined,
    );
  });

  it('menolak generate ulang periode yang sudah GENERATED (idempotency, checklist §4)', async () => {
    payrollRepository.findPeriod.mockResolvedValue({
      id: 'period-1',
      status: PayrollPeriodStatus.GENERATED,
    } as PayrollPeriod);

    await expect(
      service.generate({ companyId: 'company-1', periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR }),
    ).rejects.toMatchObject({ status: 409 });
    expect(payrollRepository.createItem).not.toHaveBeenCalled();
  });

  it('memancarkan event payroll.generated & mengubah status period menjadi GENERATED setelah sukses', async () => {
    payrollRepository.findActiveSalaryStructures.mockResolvedValue([
      makeSalaryStructure('Gaji Pokok', '6000000.00', true),
    ]);

    const result = await service.generate({
      companyId: 'company-1',
      periodMonth: PERIOD_MONTH,
      periodYear: PERIOD_YEAR,
    });

    expect(payrollRepository.updatePeriod).toHaveBeenCalledWith(
      'period-1',
      expect.objectContaining({ status: PayrollPeriodStatus.GENERATED }),
      undefined,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payroll.generated',
      expect.objectContaining({ payrollPeriodId: 'period-1', payrollItemIds: ['item-1'] }),
    );
    expect(result.status).toBe(PayrollPeriodStatus.GENERATED);
  });

  describe('approve', () => {
    it('mengubah status GENERATED->APPROVED & mencatat audit log DALAM SATU transaction (checklist §7)', async () => {
      payrollRepository.findPeriodById.mockResolvedValue({
        id: 'period-1',
        status: PayrollPeriodStatus.GENERATED,
      } as PayrollPeriod);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'hr-employee-1' } as Employee);
      payrollRepository.updatePeriod.mockResolvedValue({
        id: 'period-1',
        status: PayrollPeriodStatus.APPROVED,
        approvedBy: 'hr-employee-1',
      } as PayrollPeriod);

      const result = await service.approve({ userId: 'hr-user-1', role: 'HR_ADMIN' as never }, 'period-1');

      expect(payrollRepository.updatePeriod).toHaveBeenCalledWith(
        'period-1',
        { status: PayrollPeriodStatus.APPROVED, approvedBy: 'hr-employee-1' },
        undefined, // dari mock TransactionRunner (lihat runMock di beforeEach)
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'APPROVE_PAYROLL', entityType: 'payroll_period', entityId: 'period-1' }),
        undefined,
      );
      expect(result.status).toBe(PayrollPeriodStatus.APPROVED);
    });

    it('menolak dengan ConflictException jika periode belum GENERATED', async () => {
      payrollRepository.findPeriodById.mockResolvedValue({
        id: 'period-1',
        status: PayrollPeriodStatus.DRAFT,
      } as PayrollPeriod);

      await expect(
        service.approve({ userId: 'hr-user-1', role: 'HR_ADMIN' as never }, 'period-1'),
      ).rejects.toMatchObject({ status: 409 });
      expect(payrollRepository.updatePeriod).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('assignSalaryStructure', () => {
    it('membuat entry baru tanpa menutup entry lama jika belum ada entry terbuka', async () => {
      payrollRepository.findOpenSalaryStructure.mockResolvedValue(null);
      payrollRepository.createSalaryStructure.mockResolvedValue({ id: 'structure-1' } as EmployeeSalaryStructure);

      await service.assignSalaryStructure({
        employeeId: 'employee-1',
        salaryComponentId: 'component-1',
        amount: 5_000_000,
        effectiveDate: '2026-01-01',
      });

      expect(payrollRepository.closeSalaryStructure).not.toHaveBeenCalled();
      expect(payrollRepository.createSalaryStructure).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '5000000.00', effectiveDate: '2026-01-01' }),
      );
    });

    it('menutup entry terbuka (endDate = sehari sebelum effectiveDate baru) sebelum membuat entry baru — checklist §8: tidak overwrite', async () => {
      payrollRepository.findOpenSalaryStructure.mockResolvedValue({
        id: 'structure-old',
        effectiveDate: '2025-01-01',
      } as EmployeeSalaryStructure);
      payrollRepository.createSalaryStructure.mockResolvedValue({ id: 'structure-new' } as EmployeeSalaryStructure);

      await service.assignSalaryStructure({
        employeeId: 'employee-1',
        salaryComponentId: 'component-1',
        amount: 6_000_000,
        effectiveDate: '2026-07-01',
      });

      expect(payrollRepository.closeSalaryStructure).toHaveBeenCalledWith('structure-old', '2026-06-30', undefined);
      expect(payrollRepository.createSalaryStructure).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '6000000.00', effectiveDate: '2026-07-01' }),
        undefined,
      );
    });

    it('menolak dengan BadRequestException jika effectiveDate baru sebelum entry yang sedang aktif dimulai', async () => {
      payrollRepository.findOpenSalaryStructure.mockResolvedValue({
        id: 'structure-old',
        effectiveDate: '2026-07-01',
      } as EmployeeSalaryStructure);

      await expect(
        service.assignSalaryStructure({
          employeeId: 'employee-1',
          salaryComponentId: 'component-1',
          amount: 6_000_000,
          effectiveDate: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(payrollRepository.createSalaryStructure).not.toHaveBeenCalled();
    });
  });

  describe('findPeriods', () => {
    it('meneruskan page/limit ke repository & mengembalikan total untuk pagination', async () => {
      payrollRepository.findPeriods.mockResolvedValue({
        items: [{ id: 'period-1' } as PayrollPeriod],
        total: 1,
      });

      const result = await service.findPeriods('company-1', 2, 10);

      expect(payrollRepository.findPeriods).toHaveBeenCalledWith('company-1', 2, 10);
      expect(result).toEqual({ items: [{ id: 'period-1' }], total: 1, page: 2, limit: 10 });
    });
  });

  describe('createBpjsSetting / createPtkpSetting / createTerRate', () => {
    it('mengonversi rate desimal (number) ke string presisi-4 sebelum disimpan (kolom decimal(5,4))', async () => {
      payrollRepository.createBpjsSetting.mockResolvedValue({} as BpjsSetting);

      await service.createBpjsSetting({
        type: 'JHT' as never,
        companyPercentage: 0.037,
        employeePercentage: 0.02,
        effectiveDate: '2026-01-01',
      });

      expect(payrollRepository.createBpjsSetting).toHaveBeenCalledWith(
        expect.objectContaining({ companyPercentage: '0.0370', employeePercentage: '0.0200' }),
      );
    });

    it('mengonversi annualAmount PTKP ke string presisi-2 (kolom decimal(15,2))', async () => {
      payrollRepository.createPtkpSetting.mockResolvedValue({} as TaxPtkpSetting);

      await service.createPtkpSetting({ status: 'TK0', annualAmount: 54_000_000, effectiveYear: 2026 });

      expect(payrollRepository.createPtkpSetting).toHaveBeenCalledWith(
        expect.objectContaining({ annualAmount: '54000000.00', effectiveYear: 2026 }),
      );
    });

    it('mengonversi rate TER ke string presisi-4', async () => {
      payrollRepository.createTerRate.mockResolvedValue({} as TaxTerRate);

      await service.createTerRate({
        category: 'A',
        incomeFrom: 5_000_000,
        incomeTo: 10_000_000,
        rate: 0.05,
        effectiveYear: 2026,
      });

      expect(payrollRepository.createTerRate).toHaveBeenCalledWith(
        expect.objectContaining({ rate: '0.0500', incomeFrom: '5000000.00', incomeTo: '10000000.00' }),
      );
    });
  });
});
