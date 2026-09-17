/**
 * Payload event `leave.approved` (Observer Pattern, §3 & §6). Dipakai
 * AttendanceService untuk menandai attendance pada setiap tanggal di
 * `dates` sebagai ON_LEAVE, tanpa LeaveService perlu tahu detail modul
 * attendance (decoupling).
 */
export class LeaveApprovedEvent {
  constructor(
    public readonly leaveRequestId: string,
    public readonly employeeId: string,
    public readonly dates: string[],
  ) {}
}
