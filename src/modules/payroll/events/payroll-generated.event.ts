/**
 * Payload event `payroll.generated` (Observer Pattern, §3 & §6): "Commit
 * transaction, ubah status period jadi GENERATED -> Emit event
 * payroll.generated -> generate PDF slip (job queue, tidak blocking
 * request)". Listener PDF slip menyusul saat job queue/PDF renderer
 * tersedia — belum bagian dari tugas ini.
 */
export class PayrollGeneratedEvent {
  constructor(
    public readonly payrollPeriodId: string,
    public readonly payrollItemIds: string[],
  ) {}
}
