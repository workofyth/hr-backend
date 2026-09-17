import { DeepPartial, EntityManager } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { UserRole } from '../../common/enums/user-role.enum';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Repository Pattern — backend-architecture-hr.md §3: EmployeeService
 * bergantung pada interface ini, bukan implementasi TypeORM konkret
 * (Dependency Inversion), supaya bisa di-unit-test dengan mock repository.
 */
export interface IEmployeeRepository {
  findAll(params: PaginationParams): Promise<PaginatedResult<Employee>>;
  findById(id: string): Promise<Employee | null>;
  findByUserId(userId: string): Promise<Employee | null>;
  findByEmployeeCode(employeeCode: string): Promise<Employee | null>;
  /**
   * Cari karyawan pertama pada sebuah company yang memegang role tertentu
   * (mis. HR_ADMIN) — dipakai HrApprovalHandler (leave/approval, §3 Chain of
   * Responsibility) untuk resolve approver level HR tanpa modul leave perlu
   * query langsung ke tabel `users`.
   */
  findFirstByCompanyAndRole(companyId: string, role: UserRole): Promise<Employee | null>;
  /**
   * Semua karyawan ACTIVE pada sebuah company, tanpa paginasi — dipakai
   * PayrollService.generate() (§6: "Ambil semua employee aktif") untuk
   * menghitung payroll_items satu company sekaligus dalam satu transaction.
   * `branchId`/`departmentId` opsional — dipakai `reports` module (roadmap
   * Phase 5: "Laporan absensi/cuti per karyawan/departemen/cabang") untuk
   * mempersempit scope laporan tanpa menambah method baru.
   */
  findActiveByCompany(companyId: string, branchId?: string, departmentId?: string): Promise<Employee[]>;
  create(data: DeepPartial<Employee>, manager?: EntityManager): Promise<Employee>;
  update(id: string, data: DeepPartial<Employee>): Promise<Employee>;
  softDelete(id: string): Promise<void>;
}
