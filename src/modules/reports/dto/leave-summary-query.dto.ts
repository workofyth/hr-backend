import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/** DTO query laporan cuti (roadmap Phase 5: "Laporan cuti — saldo, penggunaan, sisa cuti"). */
export class LeaveSummaryQueryDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsInt()
  @Min(2000)
  year: number;
}
