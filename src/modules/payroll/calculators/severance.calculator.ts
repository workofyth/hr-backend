import { Injectable } from '@nestjs/common';
import { roundToRupiah } from '../../../common/utils/currency.util';

export interface SeveranceCalculationInput {
  /** Upah 1 bulan (gaji pokok + tunjangan tetap) — sama seperti input THR. */
  monthlySalary: number;
  joinDate: string;
  terminationDate: string;
  /**
   * Multiplier Uang Pesangon (UP) — WAJIB ditentukan pemanggil berdasarkan
   * alasan PHK sebenarnya (efisiensi krn rugi, tutup bukan krn rugi,
   * pensiun, meninggal dunia, mengundurkan diri, kesalahan berat, dst —
   * PP 35/2021 mengatur multiplier berbeda per kategori). Calculator ini
   * SENGAJA tidak menebak/hardcode tabel alasan->multiplier — validasikan
   * dengan konsultan HR/legal (lihat disclaimer roadmap-aplikasi-hr.md).
   */
  severancePayMultiplier: number;
  /** Multiplier Uang Penghargaan Masa Kerja (UPMK) — sama, tergantung alasan PHK. */
  serviceAppreciationMultiplier: number;
  /**
   * Uang Penggantian Hak (UPH) — cuti tahunan belum diambil, biaya pulang,
   * dst (PP 35/2021). Bukan formula tetap terhadap masa kerja, dihitung
   * di luar calculator ini dan diteruskan sebagai angka final.
   */
  compensationPay: number;
}

export interface SeveranceCalculationResult {
  yearsOfService: number;
  severancePayBaseMonths: number;
  severancePay: number;
  serviceAppreciationPayBaseMonths: number;
  serviceAppreciationPay: number;
  compensationPay: number;
  totalSeverance: number;
}

export interface ISeveranceCalculator {
  calculate(input: SeveranceCalculationInput): SeveranceCalculationResult;
}

/**
 * SeveranceCalculator — Strategy Pattern (§3). Uang Pesangon (UP) & Uang
 * Penghargaan Masa Kerja (UPMK) dasar berdasarkan masa kerja sesuai PP
 * 35/2021 Pasal 40 — TABEL INI OBJEKTIF & SAMA UNTUK SEMUA ALASAN PHK
 * (bagian dari UU yang tidak diubah signifikan oleh UU Cipta Kerja/PP
 * 35/2021 dibanding UU 13/2003 Pasal 156). Yang BERBEDA per alasan PHK
 * adalah MULTIPLIER-nya (0x, 0.5x, 1x, 1.75x, 2x, dst) — itu yang
 * WAJIB diisi pemanggil, bukan ditebak di sini (lihat catatan input).
 */
@Injectable()
export class SeveranceCalculator implements ISeveranceCalculator {
  calculate(input: SeveranceCalculationInput): SeveranceCalculationResult {
    const yearsOfService = this.calculateYearsOfService(input.joinDate, input.terminationDate);
    const severancePayBaseMonths = this.severancePayMonths(yearsOfService);
    const serviceAppreciationPayBaseMonths = this.serviceAppreciationMonths(yearsOfService);

    const severancePay = roundToRupiah(
      severancePayBaseMonths * input.monthlySalary * input.severancePayMultiplier,
    );
    const serviceAppreciationPay = roundToRupiah(
      serviceAppreciationPayBaseMonths * input.monthlySalary * input.serviceAppreciationMultiplier,
    );
    const compensationPay = roundToRupiah(input.compensationPay);

    return {
      yearsOfService,
      severancePayBaseMonths,
      severancePay,
      serviceAppreciationPayBaseMonths,
      serviceAppreciationPay,
      compensationPay,
      totalSeverance: severancePay + serviceAppreciationPay + compensationPay,
    };
  }

  /** Masa kerja penuh dalam tahun (desimal, presisi 2 — sesuai kolom `decimal(5,2)`). */
  private calculateYearsOfService(joinDate: string, terminationDate: string): number {
    const join = new Date(`${joinDate}T00:00:00Z`);
    const termination = new Date(`${terminationDate}T00:00:00Z`);

    let months =
      (termination.getUTCFullYear() - join.getUTCFullYear()) * 12 +
      (termination.getUTCMonth() - join.getUTCMonth());
    if (termination.getUTCDate() < join.getUTCDate()) {
      months -= 1;
    }
    return Math.round((Math.max(0, months) / 12) * 100) / 100;
  }

  /** Uang Pesangon dasar (PP 35/2021 Pasal 40) — dalam bulan upah. */
  private severancePayMonths(years: number): number {
    if (years < 1) return 1;
    if (years < 2) return 2;
    if (years < 3) return 3;
    if (years < 4) return 4;
    if (years < 5) return 5;
    if (years < 6) return 6;
    if (years < 7) return 7;
    if (years < 8) return 8;
    return 9;
  }

  /** Uang Penghargaan Masa Kerja dasar (PP 35/2021 Pasal 40) — dalam bulan upah. */
  private serviceAppreciationMonths(years: number): number {
    if (years < 3) return 0;
    if (years < 6) return 2;
    if (years < 9) return 3;
    if (years < 12) return 4;
    if (years < 15) return 5;
    if (years < 18) return 6;
    if (years < 21) return 7;
    if (years < 24) return 8;
    return 10;
  }
}
