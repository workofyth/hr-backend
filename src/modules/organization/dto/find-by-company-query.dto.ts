import { IsOptional, IsUUID } from 'class-validator';

export class FindByCompanyQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'companyId harus UUID valid' })
  companyId?: string;
}
