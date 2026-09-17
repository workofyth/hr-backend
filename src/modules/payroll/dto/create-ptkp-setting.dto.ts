import { IsInt, IsNumber, IsPositive, Matches, Min } from 'class-validator';

/** DTO master PTKP — histori per `effectiveYear`, tidak pernah overwrite. */
export class CreatePtkpSettingDto {
  @Matches(/^(TK|K)[0-3]$/, { message: "status harus salah satu dari TK0-TK3/K0-K3" })
  status: string;

  @IsNumber()
  @IsPositive()
  annualAmount: number;

  @IsInt()
  @Min(2000)
  effectiveYear: number;
}
