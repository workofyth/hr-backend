import { Injectable } from '@nestjs/common';
import { roundToRupiah } from '../../../common/utils/currency.util';

export interface OvertimeCalculationInput {
  /** Upah sebulan (gaji pokok + tunjangan tetap) — basis pembagi 1/173. */
  monthlyBaseSalary: number;
  overtimeHours: number;
  /** Faktor lembur berbeda untuk hari kerja biasa vs hari libur/istirahat mingguan. */
  isOnHolidayOrWeeklyRest: boolean;
}

export interface OvertimeCalculationResult {
  hourlyRate: number;
  overtimePay: number;
}

/** Strategy Pattern (§3) — interface komponen hitung lembur. */
export interface IOvertimeCalculator {
  calculate(input: OvertimeCalculationInput): OvertimeCalculationResult;
}

interface OvertimeTier {
  /** Jumlah jam pada tier ini (Infinity = tidak terbatas). */
  hours: number;
  multiplier: number;
}

/**
 * OvertimeCalculator — Strategy Pattern (§3). Rumus resmi Kepmenaker No.
 * 102/2004 Pasal 11, sesuai roadmap Phase 4 ("1/173 x upah sebulan, dikali
 * faktor lembur hari kerja/libur"):
 * - Hari kerja biasa : jam ke-1 = 1.5x, jam ke-2 dst = 2x upah sejam.
 * - Hari libur/istirahat mingguan (asumsi 6 hari kerja/minggu): jam ke-1..7
 *   = 2x, jam ke-8 = 3x, jam ke-9..10 = 4x upah sejam.
 * Jam ke-11+ (di luar tabel resmi) memakai multiplier tertinggi tier
 * terakhir sebagai fallback konservatif — bukan bagian resmi Kepmenaker
 * 102/2004, ditandai lewat komentar di kode, bukan disisipkan diam-diam.
 */
@Injectable()
export class OvertimeCalculator implements IOvertimeCalculator {
  private static readonly REGULAR_DAY_TIERS: OvertimeTier[] = [
    { hours: 1, multiplier: 1.5 },
    { hours: Infinity, multiplier: 2 },
  ];

  private static readonly HOLIDAY_TIERS: OvertimeTier[] = [
    { hours: 7, multiplier: 2 },
    { hours: 1, multiplier: 3 },
    { hours: 2, multiplier: 4 },
  ];

  calculate(input: OvertimeCalculationInput): OvertimeCalculationResult {
    const hourlyRate = input.monthlyBaseSalary / 173;
    const tiers = input.isOnHolidayOrWeeklyRest
      ? OvertimeCalculator.HOLIDAY_TIERS
      : OvertimeCalculator.REGULAR_DAY_TIERS;

    let remainingHours = input.overtimeHours;
    let pay = 0;

    for (const tier of tiers) {
      if (remainingHours <= 0) break;
      const hoursInTier = Math.min(remainingHours, tier.hours);
      pay += hoursInTier * tier.multiplier * hourlyRate;
      remainingHours -= hoursInTier;
    }

    if (remainingHours > 0) {
      const fallbackMultiplier = tiers[tiers.length - 1].multiplier;
      pay += remainingHours * fallbackMultiplier * hourlyRate;
    }

    return { hourlyRate, overtimePay: roundToRupiah(pay) };
  }
}
