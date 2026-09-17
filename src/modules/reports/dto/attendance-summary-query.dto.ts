import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** DTO query laporan absensi (roadmap Phase 5: "Laporan absensi per karyawan/departemen/cabang"). */
export class AttendanceSummaryQueryDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  year: number;
}
