import { DailyWagePayrollCalculator } from './daily-wage-payroll.calculator';
import { OvertimeCalculator } from './overtime.calculator';
import { BpjsCalculator, BpjsCalculationResult } from './bpjs.calculator';
import { Pph21Calculator, Pph21CalculationResult } from './pph21.calculator';
import { PayrollCalculationContext } from './base-payroll.calculator';
import { EmployeeSalaryStructure } from '../entities/employee-salary-structure.entity';
import { Employee } from '../../employee/entities/employee.entity';

describe('DailyWagePayrollCalculator (HARIAN)', () => {
  let calculator: DailyWagePayrollCalculator;
  let bpjsCalculator: jest.Mocked<Pick<BpjsCalculator, 'calculate'>>;
  let pph21Calculator: jest.Mocked<Pick<Pph21Calculator, 'calculate'>>;

  const emptyBpjsResult: BpjsCalculationResult = { components: [], totalCompanyAmount: 0, totalEmployeeAmount: 0 };
  const zeroPph21Result: Pph21CalculationResult = { ptkpStatus: 'TK0', terCategory: 'A', terRate: 0, pph21Amount: 0 };

  function makeContext(overrides: Partial<PayrollCalculationContext>): PayrollCalculationContext {
    return {
      employee: { joinDate: '2020-01-01', resignDate: null } as Employee,
      periodYear: 2026,
      periodMonth: 6,
      periodStartDate: '2026-06-01',
      periodEndDate: '2026-06-30',
      workingDaysInPeriod: 26,
      salaryStructures: [
        {
          amount: '150000.00', // upah harian
          salaryComponent: { name: 'Upah Harian', type: 'EARNING', isFixed: true },
        } as unknown as EmployeeSalaryStructure,
      ],
      unpaidLeaveDays: 0,
      overtimeHours: 0,
      isOvertimeOnHoliday: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    bpjsCalculator = { calculate: jest.fn().mockResolvedValue(emptyBpjsResult) };
    pph21Calculator = { calculate: jest.fn().mockResolvedValue(zeroPph21Result) };
    calculator = new DailyWagePayrollCalculator(
      new OvertimeCalculator(),
      bpjsCalculator as unknown as BpjsCalculator,
      pph21Calculator as unknown as Pph21Calculator,
    );
  });

  it('gross = upah harian x hari kerja penuh saat tanpa unpaid leave', async () => {
    // 150.000 x 26 hari = 3.900.000
    const result = await calculator.calculate(makeContext({}));
    expect(result.grossSalary).toBe(3_900_000);
    // Karyawan harian: hari tidak dikerjakan otomatis tidak terbayar,
    // TIDAK ada baris total_deduction_unpaid terpisah (lihat catatan di calculator).
    expect(result.totalDeductionUnpaid).toBe(0);
  });

  it('gross berkurang otomatis sesuai hari kerja aktual saat ada unpaid leave', async () => {
    // actualWorkingDays = 26 - 4 = 22 hari; 150.000 x 22 = 3.300.000
    const result = await calculator.calculate(makeContext({ unpaidLeaveDays: 4 }));
    expect(result.grossSalary).toBe(3_300_000);
    expect(result.totalDeductionUnpaid).toBe(0);
    expect(result.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ componentName: 'Upah harian x 22 hari kerja', amount: 3_300_000 })]),
    );
  });

  it('tidak pernah menghasilkan hari kerja aktual negatif walau unpaid leave melebihi hari kerja periode', async () => {
    const result = await calculator.calculate(makeContext({ unpaidLeaveDays: 30 }));
    expect(result.grossSalary).toBe(0);
  });
});
