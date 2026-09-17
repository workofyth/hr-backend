/**
 * Payload event `leave.cancelled` (Observer Pattern, §3 & §6). Hanya
 * dipancarkan saat pengajuan yang SUDAH APPROVED dibatalkan — dipakai
 * AttendanceService untuk mengembalikan status ON_LEAVE yang sebelumnya
 * dibuat (hanya untuk baris yang belum ada check-in sungguhan).
 */
export class LeaveCancelledEvent {
  constructor(
    public readonly leaveRequestId: string,
    public readonly employeeId: string,
    public readonly dates: string[],
  ) {}
}
