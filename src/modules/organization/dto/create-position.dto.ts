import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CreatePositionDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama jabatan wajib diisi' })
  title: string;

  @IsInt()
  @Min(1)
  level: number;
}
