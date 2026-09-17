import { DeepPartial, EntityManager } from 'typeorm';
import { AttendanceCorrection } from './entities/attendance-correction.entity';

/**
 * Repository Pattern untuk tabel `attendance_corrections` (§5.3) —
 * dipisah dari IAttendanceRepository (Interface Segregation, §3) karena
 * alur pengajuan/approval koreksi punya siklus hidup berbeda dari
 * pencatatan absen itu sendiri.
 */
export interface IAttendanceCorrectionRepository {
  findById(id: string): Promise<AttendanceCorrection | null>;
  create(data: DeepPartial<AttendanceCorrection>): Promise<AttendanceCorrection>;
  update(
    id: string,
    data: DeepPartial<AttendanceCorrection>,
    manager?: EntityManager,
  ): Promise<AttendanceCorrection>;
}
