import { IsInt, IsUUID, Max, Min } from 'class-validator';

/** DTO generate payroll per periode — roadmap Phase 4: `POST /payroll/generate`. */
export class GeneratePayrollDto {
  @IsUUID()
  companyId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @IsInt()
  @Min(2000)
  periodYear: number;
}
