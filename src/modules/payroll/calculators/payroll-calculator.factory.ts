import { Injectable } from '@nestjs/common';
import { IPayrollCalculator } from './base-payroll.calculator';
import { MonthlySalaryPayrollCalculator } from './monthly-salary-payroll.calculator';
import { DailyWagePayrollCalculator } from './daily-wage-payroll.calculator';
import { EmploymentType } from '../../employee/entities/employee.entity';

/**
 * PayrollCalculatorFactory — Factory Pattern (§3): "Pembuatan calculator
 * payroll sesuai jenis karyawan (tetap/kontrak/harian). Logika pemilihan
 * strategi terpusat, controller/service tidak perlu tahu detail if-else
 * jenis karyawan." PayrollService hanya memanggil `getCalculator()`.
 *
 * PKWTT (tetap) & PKWT (kontrak) -> MonthlySalaryPayrollCalculator (gaji
 * bulanan, prorata tengah-bulan). HARIAN -> DailyWagePayrollCalculator
 * (upah harian x hari kerja aktual). MAGANG disederhanakan memakai
 * MonthlySalaryPayrollCalculator juga — kepesertaan BPJS & PPh21 magang
 * punya aturan khusus (di luar cakupan tugas ini); pilihan ini akan
 * ditinjau ulang saat modul magang dibangun.
 */
@Injectable()
export class PayrollCalculatorFactory {
  constructor(
    private readonly monthlySalaryCalculator: MonthlySalaryPayrollCalculator,
    private readonly dailyWageCalculator: DailyWagePayrollCalculator,
  ) {}

  getCalculator(employmentType: EmploymentType): IPayrollCalculator {
    switch (employmentType) {
      case EmploymentType.HARIAN:
        return this.dailyWageCalculator;
      case EmploymentType.PKWTT:
      case EmploymentType.PKWT:
      case EmploymentType.MAGANG:
        return this.monthlySalaryCalculator;
    }
  }
}
