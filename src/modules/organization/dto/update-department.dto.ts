import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'parentDepartmentId harus UUID valid' })
  parentDepartmentId?: string;
}
