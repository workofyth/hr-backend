import { IsUUID } from 'class-validator';

export class FindSeveranceCalculationsQueryDto {
  @IsUUID()
  employeeId: string;
}
