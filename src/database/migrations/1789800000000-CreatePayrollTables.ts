import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration Phase 4: tabel Payroll & Kepatuhan (§5.5) dan `audit_logs`
 * (§5.6, checklist §7: "Ada audit log untuk perubahan data gaji &
 * approval" — dipakai pertama kali oleh PayrollService, mengikuti pola yang
 * sama dipakai migration Attendance untuk `notifications`). Tidak ada
 * tabel/kolom di luar skema yang didefinisikan di backend-architecture-hr.md.
 */
export class CreatePayrollTables1789800000000 implements MigrationInterface {
  name = 'CreatePayrollTables1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "salary_component_type_enum" AS ENUM ('EARNING','DEDUCTION')
    `);
    await queryRunner.query(`
      CREATE TYPE "bpjs_type_enum" AS ENUM ('JHT','JKK','JKM','JP','KESEHATAN')
    `);
    await queryRunner.query(`
      CREATE TYPE "payroll_period_status_enum" AS ENUM ('DRAFT','GENERATED','APPROVED','PAID','LOCKED')
    `);

    // -------------------------------------------------------------------
    // §5.5 Payroll & Kepatuhan
    // -------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "salary_components" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "name" varchar NOT NULL,
        "type" "salary_component_type_enum" NOT NULL,
        "is_taxable" boolean NOT NULL,
        "is_fixed" boolean NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_salary_structures" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "salary_component_id" uuid NOT NULL REFERENCES "salary_components"("id"),
        "amount" decimal(15,2) NOT NULL,
        "effective_date" date NOT NULL,
        "end_date" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_employee_salary_structures_employee" ON "employee_salary_structures" ("employee_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "tax_ptkp_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "status" varchar NOT NULL,
        "annual_amount" decimal(15,2) NOT NULL,
        "effective_year" int NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tax_ter_rates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category" varchar NOT NULL,
        "income_from" decimal(15,2) NOT NULL,
        "income_to" decimal(15,2) NOT NULL,
        "rate" decimal(5,4) NOT NULL,
        "effective_year" int NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "bpjs_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" "bpjs_type_enum" NOT NULL,
        "company_percentage" decimal(5,4) NOT NULL,
        "employee_percentage" decimal(5,4) NOT NULL,
        "max_salary_base" decimal(15,2),
        "effective_date" date NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payroll_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "companies"("id"),
        "period_month" int NOT NULL,
        "period_year" int NOT NULL,
        "status" "payroll_period_status_enum" NOT NULL DEFAULT 'DRAFT',
        "generated_at" timestamptz,
        "approved_by" uuid REFERENCES "employees"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "UQ_payroll_periods_company_month_year" UNIQUE ("company_id", "period_month", "period_year")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payroll_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payroll_period_id" uuid NOT NULL REFERENCES "payroll_periods"("id"),
        "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
        "gross_salary" decimal(15,2) NOT NULL,
        "total_overtime" decimal(15,2) NOT NULL DEFAULT 0,
        "total_deduction_unpaid" decimal(15,2) NOT NULL DEFAULT 0,
        "bpjs_company_total" decimal(15,2) NOT NULL,
        "bpjs_employee_total" decimal(15,2) NOT NULL,
        "pph21_amount" decimal(15,2) NOT NULL,
        "net_salary" decimal(15,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "UQ_payroll_items_period_employee" UNIQUE ("payroll_period_id", "employee_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payroll_items_period" ON "payroll_items" ("payroll_period_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "payroll_item_details" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payroll_item_id" uuid NOT NULL REFERENCES "payroll_items"("id"),
        "component_name" varchar NOT NULL,
        "component_type" "salary_component_type_enum" NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    // -------------------------------------------------------------------
    // §5.6 Cross-cutting
    // -------------------------------------------------------------------

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "action" varchar NOT NULL,
        "entity_type" varchar NOT NULL,
        "entity_id" uuid NOT NULL,
        "old_value" jsonb,
        "new_value" jsonb,
        "ip_address" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);

    await queryRunner.query(`DROP TABLE "payroll_item_details"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_items_period"`);
    await queryRunner.query(`DROP TABLE "payroll_items"`);
    await queryRunner.query(`DROP TABLE "payroll_periods"`);
    await queryRunner.query(`DROP TABLE "bpjs_settings"`);
    await queryRunner.query(`DROP TABLE "tax_ter_rates"`);
    await queryRunner.query(`DROP TABLE "tax_ptkp_settings"`);
    await queryRunner.query(`DROP INDEX "IDX_employee_salary_structures_employee"`);
    await queryRunner.query(`DROP TABLE "employee_salary_structures"`);
    await queryRunner.query(`DROP TABLE "salary_components"`);

    await queryRunner.query(`DROP TYPE "payroll_period_status_enum"`);
    await queryRunner.query(`DROP TYPE "bpjs_type_enum"`);
    await queryRunner.query(`DROP TYPE "salary_component_type_enum"`);
  }
}
