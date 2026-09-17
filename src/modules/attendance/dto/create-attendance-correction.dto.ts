import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO pengajuan koreksi absensi — roadmap Phase 2 "Pengajuan koreksi
 * absensi (lupa absen, GPS error) dengan approval atasan".
 */
export class CreateAttendanceCorrectionDto {
  @IsDateString({}, { message: 'requestedDate harus format tanggal YYYY-MM-DD' })
  requestedDate: string;

  @IsString()
  @IsNotEmpty({ message: 'Alasan koreksi wajib diisi' })
  reason: string;

  @IsOptional()
  @IsDateString({}, { message: 'requestedCheckIn harus format ISO 8601' })
  requestedCheckIn?: string;

  @IsOptional()
  @IsDateString({}, { message: 'requestedCheckOut harus format ISO 8601' })
  requestedCheckOut?: string;
}
