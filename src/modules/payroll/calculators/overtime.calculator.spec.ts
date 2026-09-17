import { OvertimeCalculator } from './overtime.calculator';

describe('OvertimeCalculator', () => {
  let calculator: OvertimeCalculator;

  // monthlyBaseSalary 3.460.000 / 173 = 20.000 tepat — memudahkan verifikasi manual.
  const monthlyBaseSalary = 3_460_000;

  beforeEach(() => {
    calculator = new OvertimeCalculator();
  });

  it('hari kerja biasa: jam ke-1 = 1.5x, jam ke-2 dst = 2x upah sejam (Kepmenaker 102/2004)', () => {
    // 3 jam: 1*1.5*20000 + 2*2*20000 = 30.000 + 80.000 = 110.000
    const result = calculator.calculate({
      monthlyBaseSalary,
      overtimeHours: 3,
      isOnHolidayOrWeeklyRest: false,
    });

    expect(result.hourlyRate).toBe(20_000);
    expect(result.overtimePay).toBe(110_000);
  });

  it('hari libur/istirahat mingguan: jam 1-7 = 2x, jam ke-8 = 3x, jam 9-10 = 4x', () => {
    // 9 jam: 7*2*20000 + 1*3*20000 + 1*4*20000 = 280.000 + 60.000 + 80.000 = 420.000
    const result = calculator.calculate({
      monthlyBaseSalary,
      overtimeHours: 9,
      isOnHolidayOrWeeklyRest: true,
    });

    expect(result.overtimePay).toBe(420_000);
  });

  it('hari libur lembur >10 jam: sisa jam memakai multiplier tertinggi (4x) sebagai fallback', () => {
    // 11 jam: 7*2*20000 + 1*3*20000 + 2*4*20000 + 1*4*20000(fallback) = 280.000+60.000+160.000+80.000 = 580.000
    const result = calculator.calculate({
      monthlyBaseSalary,
      overtimeHours: 11,
      isOnHolidayOrWeeklyRest: true,
    });

    expect(result.overtimePay).toBe(580_000);
  });

  it('tanpa lembur (0 jam) menghasilkan overtimePay 0', () => {
    const result = calculator.calculate({ monthlyBaseSalary, overtimeHours: 0, isOnHolidayOrWeeklyRest: false });
    expect(result.overtimePay).toBe(0);
  });
});
