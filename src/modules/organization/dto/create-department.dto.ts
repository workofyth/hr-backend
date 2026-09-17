import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama departemen wajib diisi' })
  name: string;

  @IsOptional()
  @IsUUID('4', { message: 'parentDepartmentId harus UUID valid' })
  parentDepartmentId?: string;
}
