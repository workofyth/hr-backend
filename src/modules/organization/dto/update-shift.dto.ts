import { IsInt, IsMilitaryTime, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsMilitaryTime({ message: 'startTime harus format HH:mm' })
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime({ message: 'endTime harus format HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  toleranceMinutes?: number;
}
