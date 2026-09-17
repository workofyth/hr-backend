import { Injectable } from '@nestjs/common';
import { BasePayrollCalculator, PayrollCalculationContext } from './base-payroll.calculator';
import { SalaryComponentType } from '../entities/salary-component.entity';
import { OvertimeCalculator } from './overtime.calculator';
import { BpjsCalculator } from './bpjs.calculator';
import { Pph21Calculator } from './pph21.calculator';
import { roundToRupiah } from '../../../common/utils/currency.util';

/**
 * DailyWagePayrollCalculator — untuk karyawan HARIAN (upah harian x hari
 * kerja aktual). Berbeda dari karyawan bulanan: hari yang tidak dikerjakan
 * (termasuk unpaid leave) TIDAK memunculkan baris "total_deduction_unpaid"
 * terpisah — upahnya secara alami sudah tidak mencakup hari itu (`amount`
 * di `employee_salary_structures` adalah tarif HARIAN, bukan bulanan).
 * Prorata masa kerja tengah-bulan juga tidak relevan untuk karyawan harian
 * dengan alasan yang sama.
 */
@Injectable()
export class DailyWagePayrollCalculator extends BasePayrollCalculator {
  constructor(overtimeCalculator: OvertimeCalculator, bpjsCalculator: BpjsCalculator, pph21Calculator: Pph21Calculator) {
    super(overtimeCalculator, bpjsCalculator, pph21Calculator);
  }

  protected computeEarning(context: PayrollCalculationContext) {
    const dailyRateTotal = this.sumEarningComponents(context.salaryStructures);
    const actualWorkingDays = Math.max(0, context.workingDaysInPeriod - context.unpaidLeaveDays);
    const nominalGrossSalary = roundToRupiah(dailyRateTotal * actualWorkingDays);

    // Basis lembur didekati dengan "andai bekerja penuh hari kerja periode
    // ini" — Kepmenaker 102/2004 dirancang untuk pekerja bulanan (pembagi
    // 173); untuk pekerja harian ini adalah pendekatan, bukan angka resmi
    // per-jenis-upah-harian yang punya rumus tersendiri di luar cakupan ini.
    const baseSalaryForOvertime = roundToRupiah(dailyRateTotal * context.workingDaysInPeriod);

    return {
      nominalGrossSalary,
      totalDeductionUnpaid: 0,
      baseSalaryForOvertime,
      details: [
        {
          componentName: `Upah harian x ${actualWorkingDays} hari kerja`,
          componentType: SalaryComponentType.EARNING,
          amount: nominalGrossSalary,
        },
      ],
    };
  }
}
