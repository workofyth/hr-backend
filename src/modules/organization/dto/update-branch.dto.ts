import { IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsLatitude({ message: 'latitude tidak valid' })
  latitude?: number;

  @IsOptional()
  @IsLongitude({ message: 'longitude tidak valid' })
  longitude?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'radiusMeters harus lebih dari 0' })
  radiusMeters?: number;
}
