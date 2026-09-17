import { Injectable } from '@nestjs/common';
import { roundToRupiah } from '../../../common/utils/currency.util';

export interface ThrCalculationInput {
  /** Upah 1 bulan (gaji pokok + tunjangan tetap). */
  monthlySalary: number;
  joinDate: string;
  /** Tanggal acuan penghitungan masa kerja (biasanya tanggal pembayaran THR). */
  referenceDate: string;
}

export interface ThrCalculationResult {
  monthsOfService: number;
  isProrated: boolean;
  thrAmount: number;
}

/** Strategy Pattern (§3) — interface komponen hitung THR. */
export interface IThrCalculator {
  calculate(input: ThrCalculationInput): ThrCalculationResult;
}

/**
 * ThrCalculator — Strategy Pattern (§3). THR sesuai masa kerja (roadmap
 * Phase 4), rumus PP 36/2021 & Permenaker No. 6/2016:
 * - Masa kerja >= 12 bulan -> THR = 1 x upah sebulan.
 * - Masa kerja 1-11 bulan  -> THR = (masa kerja / 12) x upah sebulan.
 * - Masa kerja < 1 bulan   -> tidak dihitung di sini (kebijakan perusahaan
 *   di luar ketentuan minimum UU — bukan tanggung jawab calculator ini).
 * Tidak ada tabel tarif untuk THR di skema §5.5 — rasio masa-kerja/12
 * adalah rumus UU itu sendiri, bukan "tarif" yang berubah per periode,
 * sehingga TIDAK melanggar aturan "jangan hardcode tarif" (yang berlaku
 * untuk BPJS/PTKP/TER, §5.5).
 */
@Injectable()
export class ThrCalculator implements IThrCalculator {
  calculate(input: ThrCalculationInput): ThrCalculationResult {
    const monthsOfService = this.countFullMonths(input.joinDate, input.referenceDate);

    if (monthsOfService >= 12) {
      return { monthsOfService, isProrated: false, thrAmount: roundToRupiah(input.monthlySalary) };
    }

    const thrAmount = (monthsOfService / 12) * input.monthlySalary;
    return { monthsOfService, isProrated: true, thrAmount: roundToRupiah(thrAmount) };
  }

  private countFullMonths(joinDate: string, referenceDate: string): number {
    const join = new Date(`${joinDate}T00:00:00Z`);
    const reference = new Date(`${referenceDate}T00:00:00Z`);

    let months =
      (reference.getUTCFullYear() - join.getUTCFullYear()) * 12 + (reference.getUTCMonth() - join.getUTCMonth());
    if (reference.getUTCDate() < join.getUTCDate()) {
      months -= 1;
    }
    return Math.max(0, months);
  }
}
