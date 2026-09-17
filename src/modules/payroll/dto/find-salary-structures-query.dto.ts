import { IsUUID } from 'class-validator';

export class FindSalaryStructuresQueryDto {
  @IsUUID()
  employeeId: string;
}
