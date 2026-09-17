import { IsInt, IsUUID, Max, Min } from 'class-validator';

/** DTO query laporan payroll (roadmap Phase 5: "Laporan payroll — rekap gaji, PPh 21, BPJS"). */
export class PayrollSummaryQueryDto {
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
