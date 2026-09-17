import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration Phase 2: tabel Absensi/Geofencing (§5.3) dan `notifications`
 * (§5.6, dipakai NotificationService untuk Observer Pattern §3) dari
 * backend-architecture-hr.md. Tidak ada tabel/kolom di luar skema yang
 * didefinisikan di dokumen tersebut.
 */
export class CreateAttendanceTables1789627248159 implements MigrationInterface {
  name = 'CreateAttendanceTables1789627248159';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "attendance_status_enum" AS ENUM
        ('ON_TIME','LATE','EARLY_LEAVE','ABSENT','ON_LEAVE','WFH')
    `);
    await queryRunner.query(`
      CREATE TYPE "attendance_correction_status_enum" AS ENUM ('PENDING','APPROVED','REJECTED')
    `);

    // -------------------------------------------------------------------
    // §5.3 Absensi (Radius/Geofencing)
    // -------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "attendances" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "branch_id" uuid NOT NULL REFERENCES "branches"("id"),
        "shift_id" uuid NOT NULL REFERENCES "shifts"("id"),
        "attendance_date" date NOT NULL,
        "check_in_time" timestamptz,
        "check_in_lat" decimal(10,7),
        "check_in_lng" decimal(10,7),
        "check_in_distance_meters" decimal(8,2),
        "check_in_photo_url" varchar,
        "check_out_time" timestamptz,
        "check_out_lat" decimal(10,7),
        "check_out_lng" decimal(10,7),
        "check_out_distance_meters" decimal(8,2),
        "status" "attendance_status_enum" NOT NULL,
        "work_duration_minutes" int,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "UQ_attendances_employee_date" UNIQUE ("employee_id", "attendance_date")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "attendance_corrections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "attendance_id" uuid REFERENCES "attendances"("id"),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "requested_date" date NOT NULL,
        "reason" text NOT NULL,
        "requested_check_in" timestamptz,
        "requested_check_out" timestamptz,
        "status" "attendance_correction_status_enum" NOT NULL DEFAULT 'PENDING',
        "approved_by" uuid REFERENCES "employees"("id"),
        "approved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    // -------------------------------------------------------------------
    // §5.6 Cross-cutting
    // -------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "title" varchar NOT NULL,
        "body" text NOT NULL,
        "type" varchar NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "attendance_corrections"`);
    await queryRunner.query(`DROP TABLE "attendances"`);

    await queryRunner.query(`DROP TYPE "attendance_correction_status_enum"`);
    await queryRunner.query(`DROP TYPE "attendance_status_enum"`);
  }
}
