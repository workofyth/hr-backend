import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;
}
