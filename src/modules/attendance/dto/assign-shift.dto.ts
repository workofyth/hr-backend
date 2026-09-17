import { IsDateString, IsUUID } from 'class-validator';

/**
 * DTO assign shift ke karyawan (§5.2 `employee_shift_assignments`).
 * Penugasan LAMA yang masih terbuka (endDate null) otomatis ditutup
 * (bukan overwrite) — lihat `AttendanceService.assignShift()`.
 */
export class AssignShiftDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  shiftId: string;

  @IsDateString({}, { message: 'effectiveDate harus format tanggal YYYY-MM-DD' })
  effectiveDate: string;
}
