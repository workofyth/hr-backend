/**
 * Payload event `leave.rejected` (Observer Pattern, §3 & §6). Dipakai
 * NotificationModule untuk memberitahu karyawan pengaju tanpa LeaveService
 * perlu tahu detail modul notifikasi (decoupling). `userId` (bukan cuma
 * `employeeId`) disertakan langsung — `notifications.user_id` adalah FK
 * ke `users`, bukan `employees`.
 */
export class LeaveRejectedEvent {
  constructor(
    public readonly leaveRequestId: string,
    public readonly employeeId: string,
    public readonly userId: string,
    public readonly startDate: string,
    public readonly endDate: string,
    public readonly comment: string | null,
  ) {}
}
