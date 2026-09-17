import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration awal: tabel Core/Organisasi (§5.1) dan Karyawan & Auth (§5.2)
 * dari backend-architecture-hr.md. Tidak ada tabel/kolom di luar skema
 * yang didefinisikan di dokumen tersebut.
 */
export class CreateCoreAndEmployeeAuthTables1789610620235 implements MigrationInterface {
  name = 'CreateCoreAndEmployeeAuthTables1789610620235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() built-in sejak PostgreSQL 13; pgcrypto dijaga untuk
    // kompatibilitas versi lebih lama.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('SUPER_ADMIN','HR_ADMIN','MANAGER','EMPLOYEE','FINANCE')
    `);
    await queryRunner.query(`
      CREATE TYPE "employment_type_enum" AS ENUM ('PKWTT','PKWT','HARIAN','MAGANG')
    `);
    await queryRunner.query(`
      CREATE TYPE "marital_status_enum" AS ENUM ('TK','K')
    `);
    await queryRunner.query(`
      CREATE TYPE "employee_status_enum" AS ENUM ('ACTIVE','INACTIVE','RESIGNED')
    `);

    // ---------------------------------------------------------------------
    // §5.1 Core / Organisasi
    // ---------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "npwp" varchar,
        "address" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "branches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "name" varchar NOT NULL,
        "latitude" decimal(10,7) NOT NULL,
        "longitude" decimal(10,7) NOT NULL,
        "radius_meters" int NOT NULL DEFAULT 100,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "name" varchar NOT NULL,
        "parent_department_id" uuid REFERENCES "departments"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "positions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "title" varchar NOT NULL,
        "level" int NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "shifts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "name" varchar NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "tolerance_minutes" int NOT NULL DEFAULT 15,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "holidays" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "date" date NOT NULL,
        "name" varchar NOT NULL,
        "is_national" boolean NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    // ---------------------------------------------------------------------
    // §5.2 Karyawan & Auth
    // ---------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "phone" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "role" "user_role_enum" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "branch_id" uuid NOT NULL REFERENCES "branches"("id"),
        "department_id" uuid NOT NULL REFERENCES "departments"("id"),
        "position_id" uuid NOT NULL REFERENCES "positions"("id"),
        "manager_id" uuid REFERENCES "employees"("id"),
        "employee_code" varchar NOT NULL UNIQUE,
        "full_name" varchar NOT NULL,
        "nik" varchar NOT NULL,
        "npwp" varchar,
        "bank_account_no" varchar NOT NULL,
        "bank_name" varchar NOT NULL,
        "employment_type" "employment_type_enum" NOT NULL,
        "join_date" date NOT NULL,
        "resign_date" date,
        "marital_status" "marital_status_enum" NOT NULL,
        "dependents_count" int NOT NULL DEFAULT 0,
        "status" "employee_status_enum" NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "type" varchar NOT NULL,
        "file_url" varchar NOT NULL,
        "uploaded_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_shift_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "shift_id" uuid NOT NULL REFERENCES "shifts"("id"),
        "effective_date" date NOT NULL,
        "end_date" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "employee_shift_assignments"`);
    await queryRunner.query(`DROP TABLE "employee_documents"`);
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "holidays"`);
    await queryRunner.query(`DROP TABLE "shifts"`);
    await queryRunner.query(`DROP TABLE "positions"`);
    await queryRunner.query(`DROP TABLE "departments"`);
    await queryRunner.query(`DROP TABLE "branches"`);
    await queryRunner.query(`DROP TABLE "companies"`);

    await queryRunner.query(`DROP TYPE "employee_status_enum"`);
    await queryRunner.query(`DROP TYPE "marital_status_enum"`);
    await queryRunner.query(`DROP TYPE "employment_type_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
