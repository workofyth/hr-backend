import { DeepPartial, EntityManager } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import { EmployeeShiftAssignment } from '../employee/entities/employee-shift-assignment.entity';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface FindHistoryParams extends PaginationParams {
  employeeId: string;
  month?: number;
  year?: number;
}

/**
 * Repository Pattern — backend-architecture-hr.md §3: AttendanceService
 * bergantung pada interface ini (Dependency Inversion), bukan implementasi
 * TypeORM konkret, supaya bisa di-unit-test dengan mock repository.
 */
export interface IAttendanceRepository {
  findByEmployeeAndDate(employeeId: string, attendanceDate: string): Promise<Attendance | null>;
  findById(id: string): Promise<Attendance | null>;
  findHistory(params: FindHistoryParams): Promise<PaginatedResult<Attendance>>;
  create(data: DeepPartial<Attendance>, manager?: EntityManager): Promise<Attendance>;
  update(id: string, data: DeepPartial<Attendance>, manager?: EntityManager): Promise<Attendance>;
  /**
   * Cari penugasan shift karyawan yang berlaku pada tanggal tertentu
   * (employee_shift_assignments §5.2) — dipakai untuk menentukan jam kerja
   * acuan (status ON_TIME/LATE/EARLY_LEAVE).
   */
  findActiveShiftAssignment(
    employeeId: string,
    date: string,
  ): Promise<EmployeeShiftAssignment | null>;
}
