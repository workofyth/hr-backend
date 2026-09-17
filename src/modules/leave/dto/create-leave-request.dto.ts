import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, IsUrl } from 'class-validator';

/**
 * DTO pengajuan cuti — roadmap-aplikasi-hr.md Phase 3: "Form pengajuan cuti
 * dengan lampiran (surat dokter, dll)".
 */
export class CreateLeaveRequestDto {
  @IsUUID()
  leaveTypeId: string;

  @IsDateString({}, { message: 'startDate harus format tanggal YYYY-MM-DD' })
  startDate: string;

  @IsDateString({}, { message: 'endDate harus format tanggal YYYY-MM-DD' })
  endDate: string;

  @IsString()
  @IsNotEmpty({ message: 'Alasan cuti wajib diisi' })
  reason: string;

  @IsOptional()
  @IsUrl({}, { message: 'attachmentUrl harus URL valid' })
  attachmentUrl?: string;
}
