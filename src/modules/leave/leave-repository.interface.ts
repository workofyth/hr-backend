import { DeepPartial, EntityManager } from 'typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveRequest, LeaveRequestStatus } from './entities/leave-request.entity';
import { LeaveApproval } from './entities/leave-approval.entity';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Repository Pattern — backend-architecture-hr.md §3: LeaveService
 * bergantung pada interface ini (Dependency Inversion), bukan implementasi
 * TypeORM konkret, supaya bisa di-unit-test dengan mock repository. Satu
 * interface untuk 4 tabel §5.4 (leave_types/leave_balances/leave_requests/
 * leave_approvals) — mengikuti struktur folder `leave.repository.ts`
 * tunggal yang didefinisikan di backend-architecture-hr.md §2.
 */
export interface ILeaveRepository {
  findLeaveTypeById(id: string): Promise<LeaveType | null>;
  findAllLeaveTypes(companyId?: string): Promise<LeaveType[]>;

  findBalance(employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalance | null>;
  findBalancesByEmployee(employeeId: string, year: number): Promise<LeaveBalance[]>;
  updateBalance(id: string, data: DeepPartial<LeaveBalance>, manager?: EntityManager): Promise<LeaveBalance>;

  findRequestById(id: string): Promise<LeaveRequest | null>;
  findRequestsByEmployee(employeeId: string, params: PaginationParams): Promise<PaginatedResult<LeaveRequest>>;
  /**
   * Pengajuan cuti APPROVED milik seorang karyawan yang rentang tanggalnya
   * beririsan dengan [startDate, endDate] — dipakai PayrollService untuk
   * "Potongan ... unpaid leave" (roadmap Phase 4) tanpa modul payroll perlu
   * tahu detail tabel `leave_requests`. `leaveType` di-eager-load supaya
   * caller bisa cek `isPaid` tanpa query tambahan.
   */
  findApprovedRequestsOverlapping(employeeId: string, startDate: string, endDate: string): Promise<LeaveRequest[]>;
  createRequest(data: DeepPartial<LeaveRequest>, manager?: EntityManager): Promise<LeaveRequest>;
  updateRequest(id: string, data: DeepPartial<LeaveRequest>, manager?: EntityManager): Promise<LeaveRequest>;

  findApprovalsByRequestId(requestId: string): Promise<LeaveApproval[]>;
  createApproval(data: DeepPartial<LeaveApproval>, manager?: EntityManager): Promise<LeaveApproval>;
  updateApproval(id: string, data: DeepPartial<LeaveApproval>, manager?: EntityManager): Promise<LeaveApproval>;

  /**
   * Hitung jumlah `leave_requests` seorang karyawan pada satu `status` —
   * dipakai `reports` module (roadmap Phase 5: "Laporan cuti") untuk
   * menghitung pengajuan PENDING yang masih menunggu approval. Query
   * `WHERE employee_id = :id AND status = :status` memanfaatkan composite
   * index `(employee_id, status)` (§5 "Indexing penting").
   */
  countByEmployeeAndStatus(employeeId: string, status: LeaveRequestStatus): Promise<number>;
}
