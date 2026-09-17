export const PAYROLL_REPOSITORY = Symbol('PAYROLL_REPOSITORY');

/**
 * Observer/Event-driven (§3 & §6): "Commit transaction ... Emit event
 * payroll.generated -> generate PDF slip (job queue, tidak blocking
 * request)". Listener PDF slip menyusul saat job queue/PDF renderer
 * tersedia (belum bagian dari tugas ini) — event tetap dipancarkan
 * sekarang supaya modul lain bisa didaftarkan sebagai listener nanti
 * tanpa mengubah PayrollService.
 */
export const PAYROLL_GENERATED_EVENT = 'payroll.generated';
