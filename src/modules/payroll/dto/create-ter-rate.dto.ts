import { IsIn, IsInt, IsNumber, Max, Min } from 'class-validator';

/** DTO tabel TER PPh21 (PMK 168/2023) — histori per `effectiveYear`, tidak pernah overwrite. */
export class CreateTerRateDto {
  @IsIn(['A', 'B', 'C'], { message: 'category harus A, B, atau C' })
  category: string;

  @IsNumber()
  @Min(0)
  incomeFrom: number;

  @IsNumber()
  @Min(0)
  incomeTo: number;

  @IsNumber()
  @Min(0)
  @Max(1, { message: 'rate harus desimal 0-1 (mis. 0.05 untuk 5%)' })
  rate: number;

  @IsInt()
  @Min(2000)
  effectiveYear: number;
}
