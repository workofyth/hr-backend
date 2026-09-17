import { IsUUID } from 'class-validator';

export class FindSalaryComponentsQueryDto {
  @IsUUID()
  companyId: string;
}
