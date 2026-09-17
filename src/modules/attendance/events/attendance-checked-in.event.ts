import { AttendanceStatus } from '../entities/attendance.entity';

/**
 * Payload event `attendance.checked_in` (Observer Pattern, §3 & §6).
 * Dipakai NotificationService untuk mengirim notifikasi async tanpa
 * AttendanceService perlu tahu detail modul notifikasi (decoupling).
 */
export class AttendanceCheckedInEvent {
  constructor(
    public readonly attendanceId: string,
    public readonly employeeId: string,
    public readonly userId: string,
    public readonly checkInTime: Date,
    public readonly status: AttendanceStatus,
  ) {}
}
