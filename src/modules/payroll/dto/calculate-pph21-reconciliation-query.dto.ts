import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

/** DTO query rekonsiliasi tahunan PPh21 (roadmap Phase 4, "TER tahunan/Desember"). */
export class CalculatePph21ReconciliationQueryDto {
  @IsUUID()
  employeeId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;
}
