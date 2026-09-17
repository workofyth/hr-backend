import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: tabel `payslips` (backend-architecture-hr.md §5.5) —
 * didokumentasikan sejak Phase 4 namun belum pernah dibuat. Sama seperti
 * `notifications`/`audit_logs` (§5.6), tabel ini HANYA punya `generated_at`
 * (bukan BaseEntity §5 penuh) — persis kolom yang didokumentasikan di
 * skema, bersifat append-only (slip tidak pernah diedit, hanya dibuat
 * ulang/diganti barisnya jika perlu). UNIQUE `payroll_item_id` — satu slip
 * per payroll_item (idempotency, checklist §4: generate ulang
 * mengembalikan slip yang sudah ada, bukan duplikat).
 */
export class CreatePayslipsTable1789910000000 implements MigrationInterface {
  name = 'CreatePayslipsTable1789910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payslips" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payroll_item_id" uuid NOT NULL REFERENCES "payroll_items"("id"),
        "file_url" varchar NOT NULL,
        "generated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payslips_payroll_item" UNIQUE ("payroll_item_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payslips"`);
  }
}
