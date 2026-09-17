import { IsOptional, IsUUID } from 'class-validator';

export class FindHolidaysQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'companyId harus UUID valid' })
  companyId?: string;
}
