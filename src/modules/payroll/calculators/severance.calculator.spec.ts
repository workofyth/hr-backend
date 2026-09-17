import { SeveranceCalculator } from './severance.calculator';

describe('SeveranceCalculator', () => {
  const calculator = new SeveranceCalculator();

  describe('tabel dasar Uang Pesangon (UP) & Uang Penghargaan Masa Kerja (UPMK) — PP 35/2021 Pasal 40', () => {
    it.each([
      ['2025-12-01', 0.5, 1, 0],
      ['2024-12-01', 1.5, 2, 0],
      ['2023-08-01', 2.83, 3, 0],
      ['2022-06-01', 4.0, 5, 2],
      ['2018-08-01', 7.83, 8, 3],
      ['2018-06-01', 8.0, 9, 3],
      ['2002-08-01', 23.83, 9, 8],
      ['2002-06-01', 24.0, 9, 10],
    ])(
      'join %s -> masa kerja %s tahun -> UP dasar %s bulan, UPMK dasar %s bulan',
      (joinDate, expectedYears, upMonths, upmkMonths) => {
        const result = calculator.calculate({
          monthlySalary: 5_000_000,
          joinDate,
          terminationDate: '2026-06-01',
          severancePayMultiplier: 1,
          serviceAppreciationMultiplier: 1,
          compensationPay: 0,
        });

        expect(result.yearsOfService).toBe(expectedYears);
        expect(result.severancePayBaseMonths).toBe(upMonths);
        expect(result.serviceAppreciationPayBaseMonths).toBe(upmkMonths);
      },
    );
  });

  it('menghitung yearsOfService dari joinDate/terminationDate (desimal presisi 2)', () => {
    const result = calculator.calculate({
      monthlySalary: 5_000_000,
      joinDate: '2020-01-01',
      terminationDate: '2026-07-01', // 6 tahun 6 bulan penuh
      severancePayMultiplier: 1,
      serviceAppreciationMultiplier: 1,
      compensationPay: 0,
    });

    expect(result.yearsOfService).toBe(6.5);
  });

  it('mengalikan dasar dengan multiplier yang diberikan pemanggil (bukan hardcode per alasan PHK)', () => {
    // join 2021-06-01 -> 2026-06-01 = 5 tahun -> UP dasar 6 bulan, UPMK dasar 2 bulan.
    const result = calculator.calculate({
      monthlySalary: 5_000_000,
      joinDate: '2021-06-01',
      terminationDate: '2026-06-01',
      severancePayMultiplier: 0.5, // mis. efisiensi karena perusahaan rugi
      serviceAppreciationMultiplier: 1,
      compensationPay: 1_000_000,
    });

    expect(result.severancePay).toBe(6 * 5_000_000 * 0.5);
    expect(result.serviceAppreciationPay).toBe(2 * 5_000_000 * 1);
    expect(result.compensationPay).toBe(1_000_000);
    expect(result.totalSeverance).toBe(result.severancePay + result.serviceAppreciationPay + 1_000_000);
  });

  it('multiplier 0 (mis. mengundurkan diri) menghasilkan UP/UPMK nol, hanya UPH yang tersisa', () => {
    const result = calculator.calculate({
      monthlySalary: 5_000_000,
      joinDate: '2016-06-01',
      terminationDate: '2026-06-01',
      severancePayMultiplier: 0,
      serviceAppreciationMultiplier: 0,
      compensationPay: 500_000,
    });

    expect(result.severancePay).toBe(0);
    expect(result.serviceAppreciationPay).toBe(0);
    expect(result.totalSeverance).toBe(500_000);
  });
});
