import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration Phase 3: tabel Cuti & Izin (§5.4) dari backend-architecture-hr.md.
 * Tidak ada tabel/kolom di luar skema yang didefinisikan di dokumen tersebut.
 */
export class CreateLeaveTables1789700000000 implements MigrationInterface {
  name = 'CreateLeaveTables1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "leave_request_status_enum" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED')
    `);
    await queryRunner.query(`
      CREATE TYPE "leave_approval_status_enum" AS ENUM ('PENDING','APPROVED','REJECTED')
    `);

    // -------------------------------------------------------------------
    // §5.4 Cuti & Izin
    // -------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "leave_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "name" varchar NOT NULL,
        "is_paid" boolean NOT NULL DEFAULT true,
        "default_days_per_year" int,
        "requires_attachment" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_balances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id"),
        "year" int NOT NULL,
        "entitled_days" decimal(5,2) NOT NULL,
        "used_days" decimal(5,2) NOT NULL DEFAULT 0,
        "carried_over_days" decimal(5,2) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "UQ_leave_balances_employee_type_year" UNIQUE ("employee_id", "leave_type_id", "year")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "leave_type_id" uuid NOT NULL REFERENCES "leave_types"("id"),
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "total_days" decimal(5,2) NOT NULL,
        "reason" text NOT NULL,
        "attachment_url" varchar,
        "status" "leave_request_status_enum" NOT NULL DEFAULT 'PENDING',
        "current_approval_level" int NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_leave_requests_employee_status" ON "leave_requests" ("employee_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_approvals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "leave_request_id" uuid NOT NULL REFERENCES "leave_requests"("id"),
        "approver_id" uuid NOT NULL REFERENCES "employees"("id"),
        "level" int NOT NULL,
        "status" "leave_approval_status_enum" NOT NULL DEFAULT 'PENDING',
        "comment" text,
        "acted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "leave_approvals"`);
    await queryRunner.query(`DROP INDEX "IDX_leave_requests_employee_status"`);
    await queryRunner.query(`DROP TABLE "leave_requests"`);
    await queryRunner.query(`DROP TABLE "leave_balances"`);
    await queryRunner.query(`DROP TABLE "leave_types"`);

    await queryRunner.query(`DROP TYPE "leave_approval_status_enum"`);
    await queryRunner.query(`DROP TYPE "leave_request_status_enum"`);
  }
}
