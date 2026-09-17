import { IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateBranchDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama cabang wajib diisi' })
  name: string;

  @IsLatitude({ message: 'latitude tidak valid' })
  latitude: number;

  @IsLongitude({ message: 'longitude tidak valid' })
  longitude: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'radiusMeters harus lebih dari 0' })
  radiusMeters?: number;
}
