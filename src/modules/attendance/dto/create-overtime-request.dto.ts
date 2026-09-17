import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO pengajuan lembur — backend-architecture-hr.md §5.3, roadmap Phase 2.
 */
export class CreateOvertimeRequestDto {
  @IsDateString({}, { message: 'date harus format tanggal YYYY-MM-DD' })
  date: string;

  @IsDateString({}, { message: 'startTime harus format ISO 8601' })
  startTime: string;

  @IsDateString({}, { message: 'endTime harus format ISO 8601' })
  endTime: string;

  @IsString()
  @IsNotEmpty({ message: 'Alasan lembur wajib diisi' })
  reason: string;
}
