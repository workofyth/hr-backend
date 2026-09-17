import { mkdirSync } from 'fs';
import { join } from 'path';

export const PAYROLL_REPOSITORY = Symbol('PAYROLL_REPOSITORY');

/**
 * Observer/Event-driven (§3 & §6): "Commit transaction ... Emit event
 * payroll.generated -> generate PDF slip". Didengarkan `NotificationModule`
 * (notifikasi in-app "slip gaji sudah digenerate") — PDF slip-nya sendiri
 * dibuat ON-DEMAND saat diunduh (`PayrollService.generatePayslip`), bukan
 * lewat job queue background di titik ini (belum ada infrastruktur job
 * queue di proyek ini; generate PDF satu payroll_item cukup cepat untuk
 * dilakukan synchronous per request).
 */
export const PAYROLL_GENERATED_EVENT = 'payroll.generated';

/**
 * Direktori disk lokal untuk PDF slip gaji — pola sama dengan
 * `EMPLOYEE_DOCUMENTS_UPLOAD_DIR` (modul Employee): belum ada kredensial
 * S3/MinIO. Volume Docker `payroll_payslips` (docker-compose.yml) supaya
 * tidak hilang saat container di-rebuild.
 */
export const PAYSLIPS_UPLOAD_DIR = join(process.cwd(), 'uploads', 'payslips');
mkdirSync(PAYSLIPS_UPLOAD_DIR, { recursive: true });
