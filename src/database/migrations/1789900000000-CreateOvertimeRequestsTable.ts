import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: tabel `overtime_requests` (backend-architecture-hr.md §5.3),
 * didokumentasikan sejak roadmap Phase 2 namun belum pernah dibuat — modul
 * Payroll (Phase 4) sampai saat ini menurunkan jam lembur dari
 * `attendances.work_duration_minutes` sebagai penyederhanaan sementara.
 * Migration ini melengkapi alur pengajuan/approval lembur yang sesungguhnya.
 */
export class CreateOvertimeRequestsTable1789900000000 implements MigrationInterface {
  name = 'CreateOvertimeRequestsTable1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "overtime_request_status_enum" AS ENUM ('PENDING','APPROVED','REJECTED')
    `);

    await queryRunner.query(`
      CREATE TABLE "overtime_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "date" date NOT NULL,
        "start_time" timestamptz NOT NULL,
        "end_time" timestamptz NOT NULL,
        "reason" text NOT NULL,
        "status" "overtime_request_status_enum" NOT NULL DEFAULT 'PENDING',
        "approved_by" uuid REFERENCES "employees"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "overtime_requests"`);
    await queryRunner.query(`DROP TYPE "overtime_request_status_enum"`);
  }
}
