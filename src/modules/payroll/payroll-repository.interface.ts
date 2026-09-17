import { DeepPartial, EntityManager } from 'typeorm';
import { SalaryComponent } from './entities/salary-component.entity';
import { EmployeeSalaryStructure } from './entities/employee-salary-structure.entity';
import { BpjsSetting } from './entities/bpjs-setting.entity';
import { TaxPtkpSetting } from './entities/tax-ptkp-setting.entity';
import { TaxTerRate } from './entities/tax-ter-rate.entity';
import { PayrollPeriod } from './entities/payroll-period.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { PayrollItemDetail } from './entities/payroll-item-detail.entity';
import { Payslip } from './entities/payslip.entity';
import { SeveranceCalculation } from './entities/severance-calculation.entity';

/**
 * Repository Pattern — backend-architecture-hr.md §3: PayrollService &
 * calculator (Bpjs/Pph21) bergantung pada interface ini (Dependency
 * Inversion), bukan implementasi TypeORM konkret. Satu interface untuk
 * semua tabel §5.5 (salary_components s/d payroll_item_details) —
 * mengikuti pola `leave.repository.ts` tunggal (§2).
 */
export interface IPayrollRepository {
  /**
   * Master komponen gaji (§5.5, "Master komponen gaji: gaji pokok,
   * tunjangan..."). Data referensi per company — dikelola lewat endpoint
   * `PayrollController` (bukan lagi migration/SQL manual, admin-dashboard-web-hr.md §5).
   */
  findSalaryComponents(companyId: string): Promise<SalaryComponent[]>;
  createSalaryComponent(data: DeepPartial<SalaryComponent>): Promise<SalaryComponent>;

  /** Struktur gaji karyawan yang berlaku pada `asOfDate` (§5.5). */
  findActiveSalaryStructures(employeeId: string, asOfDate: string): Promise<EmployeeSalaryStructure[]>;
  /** Seluruh histori struktur gaji seorang karyawan (bukan cuma yang aktif) — untuk halaman kelola gaji. */
  findSalaryStructuresByEmployee(employeeId: string): Promise<EmployeeSalaryStructure[]>;
  /** Entry TERBUKA (endDate null) untuk employee+component yang sama — dipakai untuk auto-tutup saat entry baru dibuat (checklist §8 dashboard: "tidak pernah overwrite data lama"). */
  findOpenSalaryStructure(employeeId: string, salaryComponentId: string): Promise<EmployeeSalaryStructure | null>;
  createSalaryStructure(
    data: DeepPartial<EmployeeSalaryStructure>,
    manager?: EntityManager,
  ): Promise<EmployeeSalaryStructure>;
  closeSalaryStructure(id: string, endDate: string, manager?: EntityManager): Promise<void>;

  /**
   * Satu baris `bpjs_settings` TERBARU per `type` (JHT/JKK/JKM/JP/KESEHATAN)
   * yang berlaku pada `asOfDate` — checklist §7: tarif tidak boleh hardcode.
   */
  findActiveBpjsSettings(asOfDate: string): Promise<BpjsSetting[]>;
  /** Seluruh histori setting BPJS (semua tanggal berlaku) — untuk halaman pengaturan. */
  findAllBpjsSettings(): Promise<BpjsSetting[]>;
  createBpjsSetting(data: DeepPartial<BpjsSetting>): Promise<BpjsSetting>;

  findPtkpSetting(status: string, effectiveYear: number): Promise<TaxPtkpSetting | null>;
  findAllPtkpSettings(): Promise<TaxPtkpSetting[]>;
  createPtkpSetting(data: DeepPartial<TaxPtkpSetting>): Promise<TaxPtkpSetting>;

  /** Baris `tax_ter_rates` untuk kategori+tahun dengan bracket yang memuat `grossIncome`. */
  findTerRate(category: string, effectiveYear: number, grossIncome: number): Promise<TaxTerRate | null>;
  findAllTerRates(): Promise<TaxTerRate[]>;
  createTerRate(data: DeepPartial<TaxTerRate>): Promise<TaxTerRate>;

  findPeriodById(id: string): Promise<PayrollPeriod | null>;
  findPeriod(companyId: string, periodMonth: number, periodYear: number): Promise<PayrollPeriod | null>;
  /**
   * Riwayat periode payroll satu company, terbaru dulu — dipakai dashboard
   * (admin-dashboard-web-hr.md) untuk halaman "Payroll" alih-alih hanya
   * form generate periode baru.
   */
  findPeriods(companyId: string, page: number, limit: number): Promise<{ items: PayrollPeriod[]; total: number }>;
  createPeriod(data: DeepPartial<PayrollPeriod>, manager?: EntityManager): Promise<PayrollPeriod>;
  updatePeriod(id: string, data: DeepPartial<PayrollPeriod>, manager?: EntityManager): Promise<PayrollPeriod>;

  findItemsByPeriod(periodId: string): Promise<PayrollItem[]>;
  /** Satu payroll_item + relasi `employee`/`payrollPeriod` — dipakai `generatePayslip` untuk header slip. */
  findItemById(id: string): Promise<PayrollItem | null>;
  /**
   * Seluruh payroll_items satu karyawan sepanjang satu `periodYear`
   * (lintas periode/bulan) — dipakai rekonsiliasi tahunan PPh21
   * (`PayrollService.calculatePph21Reconciliation`).
   */
  findItemsByEmployeeAndYear(employeeId: string, periodYear: number): Promise<PayrollItem[]>;
  createItem(data: DeepPartial<PayrollItem>, manager?: EntityManager): Promise<PayrollItem>;

  findItemDetails(payrollItemId: string): Promise<PayrollItemDetail[]>;
  createItemDetail(data: DeepPartial<PayrollItemDetail>, manager?: EntityManager): Promise<PayrollItemDetail>;

  /**
   * Satu slip per payroll_item (UNIQUE `payroll_item_id`) — dipakai
   * `PayrollService.generatePayslip` untuk idempotency: jika sudah pernah
   * digenerate, kembalikan yang sudah ada, jangan generate ulang.
   */
  findPayslipByPayrollItem(payrollItemId: string): Promise<Payslip | null>;
  createPayslip(data: DeepPartial<Payslip>): Promise<Payslip>;

  /** Riwayat perhitungan pesangon satu karyawan, terbaru dulu (append-only, §5.5). */
  findSeveranceCalculationsByEmployee(employeeId: string): Promise<SeveranceCalculation[]>;
  createSeveranceCalculation(data: DeepPartial<SeveranceCalculation>): Promise<SeveranceCalculation>;
}
