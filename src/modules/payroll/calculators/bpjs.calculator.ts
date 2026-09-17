import { Inject, Injectable } from '@nestjs/common';
import { PAYROLL_REPOSITORY } from '../payroll.constants';
import { IPayrollRepository } from '../payroll-repository.interface';
import { BpjsType } from '../entities/bpjs-setting.entity';
import { parseDecimal, roundToRupiah } from '../../../common/utils/currency.util';

export interface BpjsCalculationInput {
  monthlySalary: number;
  /** Tanggal acuan cari `bpjs_settings` yang berlaku (biasanya akhir periode payroll). */
  effectiveDate: string;
}

export interface BpjsComponentResult {
  type: BpjsType;
  companyAmount: number;
  employeeAmount: number;
}

export interface BpjsCalculationResult {
  components: BpjsComponentResult[];
  totalCompanyAmount: number;
  totalEmployeeAmount: number;
}

/** Strategy Pattern (§3) — interface komponen hitung BPJS. */
export interface IBpjsCalculator {
  calculate(input: BpjsCalculationInput): Promise<BpjsCalculationResult>;
}

/**
 * BpjsCalculator — Strategy Pattern (§3). Persentase iuran & batas upah
 * pelaporan (`maxSalaryBase`) SELALU diambil dari tabel `bpjs_settings`
 * berdasarkan `effectiveDate` (checklist §7) — tidak ada angka persen
 * di-hardcode di sini. Menghitung split company/employee untuk setiap
 * jenis (JHT, JKK, JKM, JP, KESEHATAN) yang punya baris settings aktif.
 */
@Injectable()
export class BpjsCalculator implements IBpjsCalculator {
  constructor(@Inject(PAYROLL_REPOSITORY) private readonly payrollRepository: IPayrollRepository) {}

  async calculate(input: BpjsCalculationInput): Promise<BpjsCalculationResult> {
    const settings = await this.payrollRepository.findActiveBpjsSettings(input.effectiveDate);

    const components: BpjsComponentResult[] = settings.map((setting) => {
      const maxBase = setting.maxSalaryBase !== null ? parseDecimal(setting.maxSalaryBase) : null;
      const base = maxBase !== null ? Math.min(input.monthlySalary, maxBase) : input.monthlySalary;

      return {
        type: setting.type,
        companyAmount: roundToRupiah(base * parseDecimal(setting.companyPercentage)),
        employeeAmount: roundToRupiah(base * parseDecimal(setting.employeePercentage)),
      };
    });

    return {
      components,
      totalCompanyAmount: components.reduce((sum, c) => sum + c.companyAmount, 0),
      totalEmployeeAmount: components.reduce((sum, c) => sum + c.employeeAmount, 0),
    };
  }
}
