import { Injectable } from '@nestjs/common';
import { roundToRupiah } from '../../../common/utils/currency.util';

export interface Pph21AnnualReconciliationInput {
  /** Total penghasilan bruto setahun (SUM `payroll_items.gross_salary` seluruh periode tahun ini). */
  annualGrossIncome: number;
  /** PTKP setahun (dari `tax_ptkp_settings.annual_amount`, DB-driven — TIDAK dihitung di sini). */
  ptkpAnnualAmount: number;
  /** Total PPh21 yang sudah dipotong bulanan via TER (SUM `payroll_items.pph21_amount`). */
  totalPph21Withheld: number;
}

export interface Pph21AnnualReconciliationResult {
  occupationalExpenseDeduction: number;
  taxableIncome: number;
  totalAnnualTaxDue: number;
  totalWithheld: number;
  /** Positif = kurang bayar (potong tambahan di slip Desember). Negatif = lebih bayar (kembalikan ke karyawan). */
  decemberAdjustment: number;
}

/** Satu bracket tarif progresif — batas atas EKSKLUSIF (Infinity untuk bracket terakhir). */
interface TaxBracket {
  upTo: number;
  rate: number;
}

/**
 * Biaya jabatan: 5% dari penghasilan bruto, dibatasi Rp 500.000/bulan
 * (Rp 6.000.000/tahun) — PMK 250/2008, tidak berubah sejak lama.
 */
const OCCUPATIONAL_EXPENSE_RATE = 0.05;
const OCCUPATIONAL_EXPENSE_MONTHLY_CAP = 500_000;
const OCCUPATIONAL_EXPENSE_ANNUAL_CAP = OCCUPATIONAL_EXPENSE_MONTHLY_CAP * 12;

/**
 * Tarif progresif Pasal 17 UU PPh (sebagaimana diubah UU No. 7/2021
 * Harmonisasi Peraturan Perpajakan/HPP) — 5 lapis, berlaku sejak tahun
 * pajak 2022 dan TIDAK diubah oleh PMK 168/2023 (yang hanya mengubah
 * METODE PEMOTONGAN BULANAN ke TER; kewajiban pajak TAHUNAN tetap
 * dihitung progresif seperti ini). SENGAJA HARDCODE (bukan dari tabel
 * `tax_ter_rates`, yang khusus TER bulanan per kategori/tahun) — ini
 * struktur UU itu sendiri, bukan "tarif" yang perusahaan/HR set per
 * periode (sama alasannya dengan rumus THR di `ThrCalculator`).
 * TETAP VALIDASIKAN dengan konsultan pajak sebelum dipakai produksi
 * (lihat disclaimer roadmap-aplikasi-hr.md) — UU bisa diamandemen.
 */
const PROGRESSIVE_TAX_BRACKETS: TaxBracket[] = [
  { upTo: 60_000_000, rate: 0.05 },
  { upTo: 250_000_000, rate: 0.15 },
  { upTo: 500_000_000, rate: 0.25 },
  { upTo: 5_000_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

export interface IPph21AnnualReconciliationCalculator {
  calculate(input: Pph21AnnualReconciliationInput): Pph21AnnualReconciliationResult;
}

/**
 * Pph21AnnualReconciliationCalculator — Strategy Pattern (§3). Rekonsiliasi
 * tahunan PPh21 (roadmap Phase 4, "TER tahunan/Desember"): bandingkan
 * total PPh21 SEHARUSNYA (metode progresif atas penghasilan setahun)
 * dengan total yang SUDAH dipotong bulanan (metode TER) — selisihnya
 * disesuaikan di slip gaji Desember (atau bulan terakhir kerja jika
 * berhenti di tengah tahun).
 */
@Injectable()
export class Pph21AnnualReconciliationCalculator implements IPph21AnnualReconciliationCalculator {
  calculate(input: Pph21AnnualReconciliationInput): Pph21AnnualReconciliationResult {
    const occupationalExpenseDeduction = Math.min(
      input.annualGrossIncome * OCCUPATIONAL_EXPENSE_RATE,
      OCCUPATIONAL_EXPENSE_ANNUAL_CAP,
    );

    const taxableIncomeRaw = input.annualGrossIncome - occupationalExpenseDeduction - input.ptkpAnnualAmount;
    // PKP dibulatkan ke bawah kelipatan Rp 1.000 (ketentuan umum penghitungan PPh21).
    const taxableIncome = Math.max(0, Math.floor(taxableIncomeRaw / 1000) * 1000);

    const totalAnnualTaxDue = roundToRupiah(this.calculateProgressiveTax(taxableIncome));
    const decemberAdjustment = totalAnnualTaxDue - input.totalPph21Withheld;

    return {
      occupationalExpenseDeduction: roundToRupiah(occupationalExpenseDeduction),
      taxableIncome,
      totalAnnualTaxDue,
      totalWithheld: roundToRupiah(input.totalPph21Withheld),
      decemberAdjustment: roundToRupiah(decemberAdjustment),
    };
  }

  private calculateProgressiveTax(taxableIncome: number): number {
    let remaining = taxableIncome;
    let previousUpTo = 0;
    let tax = 0;

    for (const bracket of PROGRESSIVE_TAX_BRACKETS) {
      if (remaining <= 0) break;
      const bracketSize = bracket.upTo - previousUpTo;
      const taxableInBracket = Math.min(remaining, bracketSize);
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      previousUpTo = bracket.upTo;
    }

    return tax;
  }
}
