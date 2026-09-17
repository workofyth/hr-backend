import { DeepPartial, EntityManager } from 'typeorm';
import { EmployeeSalaryStructure } from './entities/employee-salary-structure.entity';
import { BpjsSetting } from './entities/bpjs-setting.entity';
import { TaxPtkpSetting } from './entities/tax-ptkp-setting.entity';
import { TaxTerRate } from './entities/tax-ter-rate.entity';
import { PayrollPeriod } from './entities/payroll-period.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollItemDetail } from './entities/payroll-item-detail.entity';

/**
 * Repository Pattern — backend-architecture-hr.md §3: PayrollService &
 * calculator (Bpjs/Pph21) bergantung pada interface ini (Dependency
 * Inversion), bukan implementasi TypeORM konkret. Satu interface untuk
 * semua tabel §5.5 (salary_components s/d payroll_item_details) —
 * mengikuti pola `leave.repository.ts` tunggal (§2).
 */
export interface IPayrollRepository {
  /** Struktur gaji karyawan yang berlaku pada `asOfDate` (§5.5). */
  findActiveSalaryStructures(employeeId: string, asOfDate: string): Promise<EmployeeSalaryStructure[]>;

  /**
   * Satu baris `bpjs_settings` TERBARU per `type` (JHT/JKK/JKM/JP/KESEHATAN)
   * yang berlaku pada `asOfDate` — checklist §7: tarif tidak boleh hardcode.
   */
  findActiveBpjsSettings(asOfDate: string): Promise<BpjsSetting[]>;

  findPtkpSetting(status: string, effectiveYear: number): Promise<TaxPtkpSetting | null>;

  /** Baris `tax_ter_rates` untuk kategori+tahun dengan bracket yang memuat `grossIncome`. */
  findTerRate(category: string, effectiveYear: number, grossIncome: number): Promise<TaxTerRate | null>;

  findPeriodById(id: string): Promise<PayrollPeriod | null>;
  findPeriod(companyId: string, periodMonth: number, periodYear: number): Promise<PayrollPeriod | null>;
  createPeriod(data: DeepPartial<PayrollPeriod>, manager?: EntityManager): Promise<PayrollPeriod>;
  updatePeriod(id: string, data: DeepPartial<PayrollPeriod>, manager?: EntityManager): Promise<PayrollPeriod>;

  findItemsByPeriod(periodId: string): Promise<PayrollItem[]>;
  createItem(data: DeepPartial<PayrollItem>, manager?: EntityManager): Promise<PayrollItem>;

  findItemDetails(payrollItemId: string): Promise<PayrollItemDetail[]>;
  createItemDetail(data: DeepPartial<PayrollItemDetail>, manager?: EntityManager): Promise<PayrollItemDetail>;
}
