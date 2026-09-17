import { IsInt, IsMilitaryTime, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateShiftDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama shift wajib diisi' })
  name: string;

  @IsMilitaryTime({ message: 'startTime harus format HH:mm' })
  startTime: string;

  @IsMilitaryTime({ message: 'endTime harus format HH:mm' })
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  toleranceMinutes?: number;
}
