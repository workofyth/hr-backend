import { Injectable } from '@nestjs/common';
import {
  BasePayrollCalculator,
  PayrollCalculationContext,
  PayrollLineDetail,
} from './base-payroll.calculator';
import { SalaryComponentType } from '../entities/salary-component.entity';
import { OvertimeCalculator } from './overtime.calculator';
import { BpjsCalculator } from './bpjs.calculator';
import { Pph21Calculator } from './pph21.calculator';
import { parseDecimal, roundToRupiah } from '../../../common/utils/currency.util';

/**
 * MonthlySalaryPayrollCalculator — untuk karyawan bergaji bulanan tetap
 * (PKWTT "tetap", PKWT "kontrak", dan MAGANG sebagai penyederhanaan —
 * lihat catatan di PayrollCalculatorFactory). Menangani:
 * - Prorata gaji jika `joinDate`/`resignDate` jatuh di tengah periode
 *   (roadmap Phase 4: "Gaji pro-rata karyawan baru/resign di tengah bulan").
 * - Potongan unpaid leave: upah harian (gross bulanan / hari kerja periode)
 *   dikali jumlah hari unpaid leave.
 */
@Injectable()
export class MonthlySalaryPayrollCalculator extends BasePayrollCalculator {
  constructor(overtimeCalculator: OvertimeCalculator, bpjsCalculator: BpjsCalculator, pph21Calculator: Pph21Calculator) {
    super(overtimeCalculator, bpjsCalculator, pph21Calculator);
  }

  protected computeEarning(context: PayrollCalculationContext) {
    const fullMonthEarning = this.sumEarningComponents(context.salaryStructures);
    const fixedEarning = this.sumEarningComponents(context.salaryStructures, true);

    const { ratio } = this.computeEmploymentProrationRatio(context);
    const nominalGrossSalary = roundToRupiah(fullMonthEarning * ratio);
    const baseSalaryForOvertime = roundToRupiah(fixedEarning * ratio);

    const dailyRate = context.workingDaysInPeriod > 0 ? nominalGrossSalary / context.workingDaysInPeriod : 0;
    const totalDeductionUnpaid = roundToRupiah(dailyRate * context.unpaidLeaveDays);

    const details: PayrollLineDetail[] = context.salaryStructures
      .filter((s) => s.salaryComponent.type === SalaryComponentType.EARNING)
      .map((s) => ({
        componentName: s.salaryComponent.name,
        componentType: SalaryComponentType.EARNING,
        amount: roundToRupiah(parseDecimal(s.amount) * ratio),
      }));

    return { nominalGrossSalary, totalDeductionUnpaid, baseSalaryForOvertime, details };
  }

  private computeEmploymentProrationRatio(context: PayrollCalculationContext): { ratio: number } {
    const periodStart = new Date(`${context.periodStartDate}T00:00:00Z`);
    const periodEnd = new Date(`${context.periodEndDate}T00:00:00Z`);
    const totalCalendarDays = this.diffDaysInclusive(periodStart, periodEnd);

    const joinDate = new Date(`${context.employee.joinDate}T00:00:00Z`);
    const effectiveStart = joinDate > periodStart ? joinDate : periodStart;

    const resignDate = context.employee.resignDate ? new Date(`${context.employee.resignDate}T00:00:00Z`) : null;
    const effectiveEnd = resignDate && resignDate < periodEnd ? resignDate : periodEnd;

    if (effectiveStart > effectiveEnd) {
      return { ratio: 0 };
    }

    const employedCalendarDays = this.diffDaysInclusive(effectiveStart, effectiveEnd);
    return { ratio: employedCalendarDays / totalCalendarDays };
  }

  private diffDaysInclusive(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  }
}
