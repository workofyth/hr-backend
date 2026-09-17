import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: tabel `severance_calculations` (backend-architecture-hr.md
 * §5.5, "pesangon/PHK, sesuai PP 35/2021") — didokumentasikan sejak Phase 4
 * namun belum pernah dibuat. Sama seperti `payslips`/`notifications`
 * (§5.6), tabel ini HANYA punya `calculated_at` (bukan BaseEntity §5
 * penuh) — append-only: hitung ulang membuat BARIS BARU (audit trail
 * riwayat perhitungan), bukan mengedit baris lama.
 */
export class CreateSeveranceCalculationsTable1789920000000 implements MigrationInterface {
  name = 'CreateSeveranceCalculationsTable1789920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "severance_calculations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "termination_date" date NOT NULL,
        "reason" varchar NOT NULL,
        "years_of_service" decimal(5,2) NOT NULL,
        "severance_pay" decimal(15,2) NOT NULL,
        "service_appreciation_pay" decimal(15,2) NOT NULL,
        "compensation_pay" decimal(15,2) NOT NULL,
        "calculated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_severance_calculations_employee" ON "severance_calculations" ("employee_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "severance_calculations"`);
  }
}
