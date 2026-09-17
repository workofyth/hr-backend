import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { BpjsType } from '../entities/bpjs-setting.entity';

/** DTO setting iuran BPJS — histori per `effectiveDate`, tidak pernah overwrite (checklist §7/§8). */
export class CreateBpjsSettingDto {
  @IsEnum(BpjsType, { message: 'type harus salah satu dari JHT/JKK/JKM/JP/KESEHATAN' })
  type: BpjsType;

  @IsNumber()
  @Min(0)
  @Max(1, { message: 'companyPercentage harus desimal 0-1 (mis. 0.037 untuk 3.7%)' })
  companyPercentage: number;

  @IsNumber()
  @Min(0)
  @Max(1, { message: 'employeePercentage harus desimal 0-1 (mis. 0.02 untuk 2%)' })
  employeePercentage: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxSalaryBase?: number;

  @IsDateString({}, { message: 'effectiveDate harus format tanggal YYYY-MM-DD' })
  effectiveDate: string;
}
