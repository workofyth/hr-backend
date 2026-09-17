import { DeepPartial, EntityManager } from 'typeorm';
import { OvertimeRequest, OvertimeRequestStatus } from './entities/overtime-request.entity';

/**
 * Repository Pattern untuk tabel `overtime_requests` (§5.3) — dipisah dari
 * IAttendanceRepository (Interface Segregation, §3), sama seperti
 * IAttendanceCorrectionRepository, karena siklus hidup pengajuan/approval
 * lembur berbeda dari pencatatan absen itu sendiri.
 */
export interface IOvertimeRequestRepository {
  findById(id: string): Promise<OvertimeRequest | null>;
  /**
   * Antrian approval lembur (mirip `findByStatus` pada koreksi absensi) —
   * relasi `employee` ikut di-load supaya AttendanceService bisa menyaring
   * hasilnya per MANAGER (hanya anak buah langsung) tanpa query tambahan.
   */
  findByStatus(status: OvertimeRequestStatus): Promise<OvertimeRequest[]>;
  /**
   * Total jam lembur APPROVED milik satu employee dalam rentang tanggal
   * (inklusif) — dipakai `PayrollService.computeOvertimeHours`.
   */
  findApprovedByEmployeeAndDateRange(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<OvertimeRequest[]>;
  create(data: DeepPartial<OvertimeRequest>): Promise<OvertimeRequest>;
  update(id: string, data: DeepPartial<OvertimeRequest>, manager?: EntityManager): Promise<OvertimeRequest>;
}
