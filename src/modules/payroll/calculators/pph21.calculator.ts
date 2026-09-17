import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PAYROLL_REPOSITORY } from '../payroll.constants';
import { IPayrollRepository } from '../payroll-repository.interface';
import { Employee, MaritalStatus } from '../../employee/entities/employee.entity';
import { parseDecimal, roundToRupiah } from '../../../common/utils/currency.util';

export interface Pph21CalculationInput {
  employee: Employee;
  /** Penghasilan bruto sebulan (gaji + tunjangan + lembur, SEBELUM potongan BPJS). */
  grossMonthlyIncome: number;
  effectiveYear: number;
}

export interface Pph21CalculationResult {
  ptkpStatus: string;
  terCategory: string;
  terRate: number;
  pph21Amount: number;
}

/** Strategy Pattern (§3) — interface komponen hitung pajak (contoh eksplisit dokumen: ITaxCalculator). */
export interface ITaxCalculator {
  calculate(input: Pph21CalculationInput): Promise<Pph21CalculationResult>;
}

const MAX_PTKP_DEPENDENTS = 3;

/**
 * Pemetaan status PTKP -> kategori TER (PMK 168/2023 Lampiran I). Ini
 * adalah KLASIFIKASI REGULASI tetap (bukan tarif/angka yang berubah per
 * tahun) — skema §5.5 tidak punya kolom untuk pemetaan ini (hanya
 * `tax_ptkp_settings.annual_amount` & `tax_ter_rates.rate` yang di-versi
 * per `effective_year`), sehingga tabel ini TIDAK melanggar aturan "jangan
 * hardcode tarif" — satu-satunya nilai yang benar-benar dipakai untuk
 * menghitung PPh21 (`terRate`) tetap 100% dibaca dari `tax_ter_rates`.
 */
const PTKP_TO_TER_CATEGORY: Record<string, string> = {
  TK0: 'A',
  TK1: 'A',
  K0: 'A',
  TK2: 'B',
  TK3: 'B',
  K1: 'B',
  K2: 'B',
  K3: 'C',
};

/**
 * Pph21Calculator — Strategy Pattern (§3), metode TER (Tarif Efektif
 * Rata-rata) bulanan sesuai roadmap Phase 4 & PMK 168/2023. TER SUDAH
 * memperhitungkan PTKP di dalam tarifnya sendiri — PPh21 bulanan dihitung
 * langsung `terRate x grossMonthlyIncome`, TIDAK mengurangi PTKP/biaya
 * jabatan secara manual (itu perhitungan metode lama, sebelum TER).
 * Rekonsiliasi tahunan (Desember, metode progresif) belum diimplementasikan
 * pada fase ini — di luar permintaan tugas ini.
 */
@Injectable()
export class Pph21Calculator implements ITaxCalculator {
  constructor(@Inject(PAYROLL_REPOSITORY) private readonly payrollRepository: IPayrollRepository) {}

  async calculate(input: Pph21CalculationInput): Promise<Pph21CalculationResult> {
    const ptkpStatus = this.resolvePtkpStatus(input.employee);

    const ptkpSetting = await this.payrollRepository.findPtkpSetting(ptkpStatus, input.effectiveYear);
    if (!ptkpSetting) {
      throw new NotFoundException(
        `Setting PTKP untuk status ${ptkpStatus} tahun ${input.effectiveYear} belum dikonfigurasi`,
      );
    }

    const terCategory = PTKP_TO_TER_CATEGORY[ptkpStatus];
    const terRateSetting = await this.payrollRepository.findTerRate(
      terCategory,
      input.effectiveYear,
      input.grossMonthlyIncome,
    );
    if (!terRateSetting) {
      throw new NotFoundException(
        `Tarif TER kategori ${terCategory} tahun ${input.effectiveYear} untuk penghasilan ${input.grossMonthlyIncome} belum dikonfigurasi`,
      );
    }

    const terRate = parseDecimal(terRateSetting.rate);
    return {
      ptkpStatus,
      terCategory,
      terRate,
      pph21Amount: roundToRupiah(input.grossMonthlyIncome * terRate),
    };
  }

  private resolvePtkpStatus(employee: Employee): string {
    const dependents = Math.min(Math.max(employee.dependentsCount, 0), MAX_PTKP_DEPENDENTS);
    const maritalPrefix = employee.maritalStatus === MaritalStatus.K ? 'K' : 'TK';
    return `${maritalPrefix}${dependents}`;
  }
}
