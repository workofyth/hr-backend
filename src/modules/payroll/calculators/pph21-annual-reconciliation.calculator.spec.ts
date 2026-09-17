import { Pph21AnnualReconciliationCalculator } from './pph21-annual-reconciliation.calculator';

describe('Pph21AnnualReconciliationCalculator', () => {
  const calculator = new Pph21AnnualReconciliationCalculator();

  it('membatasi biaya jabatan 5% dari bruto MAKS Rp 6.000.000/tahun (Rp 500.000/bulan)', () => {
    // bruto besar -> 5% jauh melebihi cap 6jt -> harus dipotong ke 6jt tepat.
    const result = calculator.calculate({
      annualGrossIncome: 500_000_000, // 5% = 25jt, jauh di atas cap 6jt
      ptkpAnnualAmount: 0,
      totalPph21Withheld: 0,
    });

    expect(result.occupationalExpenseDeduction).toBe(6_000_000);
  });

  it('tidak membatasi biaya jabatan jika 5% dari bruto masih di bawah cap', () => {
    const result = calculator.calculate({
      annualGrossIncome: 60_000_000, // 5% = 3jt, di bawah cap 6jt
      ptkpAnnualAmount: 0,
      totalPph21Withheld: 0,
    });

    expect(result.occupationalExpenseDeduction).toBe(3_000_000);
  });

  it('PKP dibulatkan ke bawah kelipatan Rp 1.000 & tidak boleh negatif', () => {
    const result = calculator.calculate({
      annualGrossIncome: 5_400_999, // kecil, hasil bisa negatif sebelum floor-at-zero
      ptkpAnnualAmount: 54_000_000, // TK0 2024
      totalPph21Withheld: 0,
    });

    expect(result.taxableIncome).toBe(0);
    expect(result.totalAnnualTaxDue).toBe(0);
  });

  describe('tarif progresif Pasal 17 UU PPh (UU HPP) — 5 lapis', () => {
    it('PKP 70.000.000 (melewati batas lapis 1 di 60jt) -> 60jt@5% + 10jt@15%', () => {
      // Rakit gross supaya: gross - min(5%gross,6jt) - PTKP = 60.000.000 tepat.
      // Pilih PTKP=0, gross kecil supaya biaya jabatan = 5%*gross (di bawah cap).
      // gross - 0.05*gross = 60jt -> 0.95*gross = 60jt -> gross = 63.157.894,74 (tidak bulat)
      // Supaya presisi, pakai PTKP besar & gross yang biaya jabatannya sudah kena cap (gross > 120jt).
      const ptkp = 54_000_000;
      const grossOverCap = 130_000_000; // biaya jabatan pasti kena cap 6jt (5% dari 130jt = 6.5jt > 6jt)
      const pkp = grossOverCap - 6_000_000 - ptkp; // = 70.000.000 (bukan 60jt, lihat test lain untuk cross-bracket)
      const result = calculator.calculate({
        annualGrossIncome: grossOverCap,
        ptkpAnnualAmount: ptkp,
        totalPph21Withheld: 0,
      });

      expect(result.taxableIncome).toBe(pkp);
      // pkp=70jt -> lapis1 60jt*5%=3jt, sisa 10jt*15%=1.5jt -> total 4.5jt
      expect(result.totalAnnualTaxDue).toBe(4_500_000);
    });

    it('PKP 300.000.000 (melewati 3 lapis: 60jt@5% + 190jt@15% + 50jt@25%)', () => {
      const ptkp = 0;
      const gross = 306_000_000; // biaya jabatan kena cap 6jt -> PKP = 306jt - 6jt - 0 = 300jt
      const result = calculator.calculate({ annualGrossIncome: gross, ptkpAnnualAmount: ptkp, totalPph21Withheld: 0 });

      expect(result.taxableIncome).toBe(300_000_000);
      // 60jt*5%=3jt, (250-60)=190jt*15%=28.5jt, (300-250)=50jt*25%=12.5jt -> total 44jt
      expect(result.totalAnnualTaxDue).toBe(44_000_000);
    });

    it('PKP 5.100.000.000 (melewati SEMUA lapis termasuk 35% teratas)', () => {
      const gross = 5_106_000_000; // - cap 6jt -> PKP = 5.100.000.000
      const result = calculator.calculate({ annualGrossIncome: gross, ptkpAnnualAmount: 0, totalPph21Withheld: 0 });

      expect(result.taxableIncome).toBe(5_100_000_000);
      // 60jt*5%=3jt + 190jt*15%=28.5jt + 250jt*25%=62.5jt + 4.5M*30%=1.35M + 100jt*35%=35jt
      // = 3jt+28.5jt+62.5jt+1.350.000.000+35jt = 1.479.000.000
      expect(result.totalAnnualTaxDue).toBe(1_479_000_000);
    });
  });

  describe('decemberAdjustment', () => {
    it('positif (kurang bayar) jika total pajak progresif > yang sudah dipotong TER', () => {
      const result = calculator.calculate({
        annualGrossIncome: 306_000_000,
        ptkpAnnualAmount: 0,
        totalPph21Withheld: 40_000_000, // lebih kecil dari 44jt yang seharusnya
      });

      expect(result.decemberAdjustment).toBe(4_000_000);
    });

    it('negatif (lebih bayar) jika total yang sudah dipotong TER > pajak progresif seharusnya', () => {
      const result = calculator.calculate({
        annualGrossIncome: 306_000_000,
        ptkpAnnualAmount: 0,
        totalPph21Withheld: 50_000_000, // lebih besar dari 44jt yang seharusnya
      });

      expect(result.decemberAdjustment).toBe(-6_000_000);
    });
  });
});
