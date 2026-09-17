import { IsBoolean, IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { SalaryComponentType } from '../entities/salary-component.entity';

/** DTO master komponen gaji — roadmap Phase 4: "gaji pokok, tunjangan tetap/tidak tetap, transport, makan, jabatan". */
export class CreateSalaryComponentDto {
  @IsUUID()
  companyId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama komponen wajib diisi' })
  name: string;

  @IsEnum(SalaryComponentType, { message: 'type harus EARNING atau DEDUCTION' })
  type: SalaryComponentType;

  @IsBoolean()
  isTaxable: boolean;

  @IsBoolean()
  isFixed: boolean;
}
