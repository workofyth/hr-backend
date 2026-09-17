import { MonthlySalaryPayrollCalculator } from './monthly-salary-payroll.calculator';
import { OvertimeCalculator } from './overtime.calculator';
import { BpjsCalculator, BpjsCalculationResult } from './bpjs.calculator';
import { Pph21Calculator, Pph21CalculationResult } from './pph21.calculator';
import { PayrollCalculationContext } from './base-payroll.calculator';
import { EmployeeSalaryStructure } from '../entities/employee-salary-structure.entity';
import { Employee } from '../../employee/entities/employee.entity';

describe('MonthlySalaryPayrollCalculator (PKWTT/PKWT/MAGANG)', () => {
  let calculator: MonthlySalaryPayrollCalculator;
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
      periodEndDate: '2026-06-30', // 30 hari kalender
      workingDaysInPeriod: 30, // dipilih genap agar dailyRate bulat, bukan hasil kalender sungguhan
      salaryStructures: [
        {
          amount: '6000000.00',
          salaryComponent: { name: 'Gaji Pokok', type: 'EARNING', isFixed: true },
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
    calculator = new MonthlySalaryPayrollCalculator(
      new OvertimeCalculator(),
      bpjsCalculator as unknown as BpjsCalculator,
      pph21Calculator as unknown as Pph21Calculator,
    );
  });

  it('gross penuh saat karyawan sudah bekerja sepanjang periode (ratio prorata = 1)', async () => {
    const result = await calculator.calculate(makeContext({}));
    expect(result.grossSalary).toBe(6_000_000);
    expect(result.totalDeductionUnpaid).toBe(0);
  });

  it('prorata gaji saat karyawan baru masuk di tengah periode (roadmap Phase 4)', async () => {
    // join 2026-06-16 -> bekerja 15 dari 30 hari kalender periode -> ratio 0.5
    const result = await calculator.calculate(
      makeContext({ employee: { joinDate: '2026-06-16', resignDate: null } as Employee }),
    );
    expect(result.grossSalary).toBe(3_000_000);
  });

  it('prorata gaji saat karyawan resign di tengah periode', async () => {
    // resign 2026-06-15 -> bekerja 15 dari 30 hari kalender periode -> ratio 0.5
    const result = await calculator.calculate(
      makeContext({ employee: { joinDate: '2020-01-01', resignDate: '2026-06-15' } as Employee }),
    );
    expect(result.grossSalary).toBe(3_000_000);
  });

  it('potongan unpaid leave = (gross / hari kerja periode) x jumlah hari unpaid leave', async () => {
    // dailyRate = 6.000.000 / 30 hari kerja = 200.000/hari; 3 hari unpaid = 600.000
    const result = await calculator.calculate(makeContext({ unpaidLeaveDays: 3 }));
    expect(result.totalDeductionUnpaid).toBe(600_000);
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ componentName: 'Potongan Cuti/Izin Tidak Dibayar', amount: 600_000 }),
      ]),
    );
  });

  it('meneruskan basis lembur (fixed component saja) & basis BPJS/PPh21 = gross - unpaid ke Overtime/Bpjs/Pph21Calculator', async () => {
    await calculator.calculate(makeContext({ unpaidLeaveDays: 3 }));

    // taxableBase = gross(6.000.000) - unpaid(600.000) = 5.400.000
    expect(bpjsCalculator.calculate).toHaveBeenCalledWith(
      expect.objectContaining({ monthlySalary: 5_400_000 }),
    );
    expect(pph21Calculator.calculate).toHaveBeenCalledWith(
      expect.objectContaining({ grossMonthlyIncome: 5_400_000 }),
    );
  });
});
