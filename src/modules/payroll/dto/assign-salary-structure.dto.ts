import { IsDateString, IsNumber, IsPositive, IsUUID } from 'class-validator';

/**
 * DTO assign komponen gaji ke karyawan (§5.5 `employee_salary_structures`).
 * Entry LAMA yang masih terbuka (endDate null) untuk employee+component
 * yang sama otomatis ditutup (bukan overwrite) — lihat
 * `PayrollService.assignSalaryStructure()`.
 */
export class AssignSalaryStructureDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  salaryComponentId: string;

  @IsNumber()
  @IsPositive({ message: 'amount harus lebih dari 0' })
  amount: number;

  @IsDateString({}, { message: 'effectiveDate harus format tanggal YYYY-MM-DD' })
  effectiveDate: string;
}
