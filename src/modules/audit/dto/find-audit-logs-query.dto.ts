import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class FindAuditLogsQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId harus UUID valid' })
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID('4', { message: 'entityId harus UUID valid' })
  entityId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateFrom harus format tanggal YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateTo harus format tanggal YYYY-MM-DD' })
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
