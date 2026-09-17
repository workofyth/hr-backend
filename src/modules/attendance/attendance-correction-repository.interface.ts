import { DeepPartial, EntityManager } from 'typeorm';
import { AttendanceCorrection, AttendanceCorrectionStatus } from './entities/attendance-correction.entity';

/**
 * Repository Pattern untuk tabel `attendance_corrections` (§5.3) —
 * dipisah dari IAttendanceRepository (Interface Segregation, §3) karena
 * alur pengajuan/approval koreksi punya siklus hidup berbeda dari
 * pencatatan absen itu sendiri.
 */
export interface IAttendanceCorrectionRepository {
  findById(id: string): Promise<AttendanceCorrection | null>;
  /**
   * Antrian approval koreksi absensi (admin-dashboard-web-hr.md §5
   * "Attendance Monitoring — approval antrian koreksi") — relasi `employee`
   * ikut di-load supaya AttendanceService bisa menyaring hasilnya per
   * MANAGER (hanya anak buah langsung) tanpa query tambahan.
   */
  findByStatus(status: AttendanceCorrectionStatus): Promise<AttendanceCorrection[]>;
  create(data: DeepPartial<AttendanceCorrection>): Promise<AttendanceCorrection>;
  update(
    id: string,
    data: DeepPartial<AttendanceCorrection>,
    manager?: EntityManager,
  ): Promise<AttendanceCorrection>;
}
