import { IsUUID } from 'class-validator';

export class FindShiftAssignmentsQueryDto {
  @IsUUID()
  employeeId: string;
}
