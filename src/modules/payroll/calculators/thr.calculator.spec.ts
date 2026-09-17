import { ThrCalculator } from './thr.calculator';

describe('ThrCalculator', () => {
  let calculator: ThrCalculator;

  beforeEach(() => {
    calculator = new ThrCalculator();
  });

  it('masa kerja >= 12 bulan mendapat THR penuh (1x upah sebulan)', () => {
    const result = calculator.calculate({
      monthlySalary: 5_000_000,
      joinDate: '2024-01-15',
      referenceDate: '2025-06-15', // 17 bulan penuh
    });

    expect(result.monthsOfService).toBe(17);
    expect(result.isProrated).toBe(false);
    expect(result.thrAmount).toBe(5_000_000);
  });

  it('masa kerja < 12 bulan diprorata (masa kerja / 12 x upah sebulan)', () => {
    // join 2025-09-15 -> reference 2026-03-10: tanggal referensi (10) < tanggal join (15),
    // jadi bulan terakhir belum genap -> 5 bulan penuh (bukan 6).
    const result = calculator.calculate({
      monthlySalary: 6_000_000,
      joinDate: '2025-09-15',
      referenceDate: '2026-03-10',
    });

    expect(result.monthsOfService).toBe(5);
    expect(result.isProrated).toBe(true);
    // 6.000.000 x 5/12 = 2.500.000
    expect(result.thrAmount).toBe(2_500_000);
  });

  it('karyawan baru masuk di tanggal referensi (0 bulan) menghasilkan THR 0', () => {
    const result = calculator.calculate({
      monthlySalary: 4_000_000,
      joinDate: '2026-03-01',
      referenceDate: '2026-03-01',
    });

    expect(result.monthsOfService).toBe(0);
    expect(result.thrAmount).toBe(0);
  });
});
