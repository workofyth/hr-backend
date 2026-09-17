import { Employee } from '../../employee/entities/employee.entity';
import { EmployeeSalaryStructure } from '../entities/employee-salary-structure.entity';
import { SalaryComponentType } from '../entities/salary-component.entity';
import { OvertimeCalculator } from './overtime.calculator';
import { BpjsCalculator } from './bpjs.calculator';
import { Pph21Calculator } from './pph21.calculator';
import { parseDecimal, roundToRupiah } from '../../../common/utils/currency.util';

export interface PayrollLineDetail {
  componentName: string;
  componentType: SalaryComponentType;
  amount: number;
}

export interface PayrollCalculationContext {
  employee: Employee;
  periodYear: number;
  periodMonth: number;
  /** Tanggal awal/akhir periode (kalender), format YYYY-MM-DD. */
  periodStartDate: string;
  periodEndDate: string;
  /** Hari kerja acuan periode (§6, dipakai prorata & potongan unpaid leave). */
  workingDaysInPeriod: number;
  /** `employee_salary_structures` yang aktif pada periode ini, relasi `salaryComponent` sudah di-load. */
  salaryStructures: EmployeeSalaryStructure[];
  unpaidLeaveDays: number;
  overtimeHours: number;
  isOvertimeOnHoliday: boolean;
}

export interface PayrollCalculationResult {
  grossSalary: number;
  totalOvertime: number;
  totalDeductionUnpaid: number;
  bpjsCompanyTotal: number;
  bpjsEmployeeTotal: number;
  pph21Amount: number;
  netSalary: number;
  details: PayrollLineDetail[];
}

/**
 * IPayrollCalculator — dipilih PayrollCalculatorFactory sesuai
 * `employee.employmentType` (Factory Pattern, §3: "Pembuatan calculator
 * payroll sesuai jenis karyawan tetap/kontrak/harian").
 */
export interface IPayrollCalculator {
  calculate(context: PayrollCalculationContext): Promise<PayrollCalculationResult>;
}

interface EarningComputation {
  /** Gaji bruto nominal (SEBELUM lembur, SETELAH prorata masa kerja bila relevan). */
  nominalGrossSalary: number;
  /** Potongan unpaid leave — kolom terpisah `payroll_items.total_deduction_unpaid` (§5.5). */
  totalDeductionUnpaid: number;
  /** "Upah sebulan" basis lembur (Kepmenaker 102/2004: gaji pokok + tunjangan tetap). */
  baseSalaryForOvertime: number;
  details: PayrollLineDetail[];
}

/**
 * Template Method di atas Strategy Pattern (§3): skeleton alur hitung
 * (earning -> lembur -> BPJS -> PPh21 -> net, sesuai §6) sama untuk semua
 * jenis karyawan, hanya `computeEarning()` yang berbeda per employment_type
 * (mid-month prorate untuk karyawan bulanan vs upah harian x hari kerja
 * aktual untuk karyawan harian) — menghindari duplikasi wiring
 * Overtime/Bpjs/Pph21Calculator di dua tempat yang bisa saling menyimpang.
 */
export abstract class BasePayrollCalculator implements IPayrollCalculator {
  constructor(
    protected readonly overtimeCalculator: OvertimeCalculator,
    protected readonly bpjsCalculator: BpjsCalculator,
    protected readonly pph21Calculator: Pph21Calculator,
  ) {}

  async calculate(context: PayrollCalculationContext): Promise<PayrollCalculationResult> {
    const earning = this.computeEarning(context);

    const overtimePay =
      context.overtimeHours > 0
        ? this.overtimeCalculator.calculate({
            monthlyBaseSalary: earning.baseSalaryForOvertime,
            overtimeHours: context.overtimeHours,
            isOnHolidayOrWeeklyRest: context.isOvertimeOnHoliday,
          }).overtimePay
        : 0;

    const grossSalary = roundToRupiah(earning.nominalGrossSalary + overtimePay);
    // Basis BPJS/PPh21 = upah yang benar-benar diterima (bruto dikurangi
    // potongan unpaid leave) — bukan gross_salary nominal kontraktual.
    const taxableBase = grossSalary - earning.totalDeductionUnpaid;

    const bpjs = await this.bpjsCalculator.calculate({
      monthlySalary: taxableBase,
      effectiveDate: context.periodEndDate,
    });
    const pph21 = await this.pph21Calculator.calculate({
      employee: context.employee,
      // Metode TER: dihitung dari bruto langsung, TIDAK dikurangi BPJS
      // employee lebih dulu (lihat catatan di Pph21Calculator).
      grossMonthlyIncome: taxableBase,
      effectiveYear: context.periodYear,
    });

    const netSalary = roundToRupiah(
      grossSalary - earning.totalDeductionUnpaid - bpjs.totalEmployeeAmount - pph21.pph21Amount,
    );

    const details = [...earning.details];
    if (overtimePay > 0) {
      details.push({ componentName: 'Lembur', componentType: SalaryComponentType.EARNING, amount: overtimePay });
    }
    if (earning.totalDeductionUnpaid > 0) {
      details.push({
        componentName: 'Potongan Cuti/Izin Tidak Dibayar',
        componentType: SalaryComponentType.DEDUCTION,
        amount: earning.totalDeductionUnpaid,
      });
    }
    for (const component of bpjs.components) {
      if (component.employeeAmount > 0) {
        details.push({
          componentName: `BPJS ${component.type} (Karyawan)`,
          componentType: SalaryComponentType.DEDUCTION,
          amount: component.employeeAmount,
        });
      }
    }
    if (pph21.pph21Amount > 0) {
      details.push({
        componentName: 'PPh 21 (TER)',
        componentType: SalaryComponentType.DEDUCTION,
        amount: pph21.pph21Amount,
      });
    }

    return {
      grossSalary,
      totalOvertime: overtimePay,
      totalDeductionUnpaid: earning.totalDeductionUnpaid,
      bpjsCompanyTotal: bpjs.totalCompanyAmount,
      bpjsEmployeeTotal: bpjs.totalEmployeeAmount,
      pph21Amount: pph21.pph21Amount,
      netSalary,
      details,
    };
  }

  protected abstract computeEarning(context: PayrollCalculationContext): EarningComputation;

  /**
   * Catatan cakupan: hanya komponen `type === EARNING` yang diperhitungkan
   * di sini (contoh roadmap Phase 4 — gaji pokok, tunjangan tetap/tidak
   * tetap, transport, makan, jabatan — semuanya EARNING). Komponen custom
   * `DEDUCTION` non-statutori (di luar BPJS/PPh21/unpaid-leave, mis.
   * potongan koperasi) belum punya kolom `payroll_items` tersendiri di
   * §5.5 sehingga belum ditangani di fase ini.
   */
  protected sumEarningComponents(structures: EmployeeSalaryStructure[], fixedOnly = false): number {
    return structures
      .filter((s) => s.salaryComponent.type === SalaryComponentType.EARNING && (!fixedOnly || s.salaryComponent.isFixed))
      .reduce((sum, s) => sum + parseDecimal(s.amount), 0);
  }
}
