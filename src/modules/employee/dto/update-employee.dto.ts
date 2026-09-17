import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { EmployeeStatus, EmploymentType, MaritalStatus } from '../entities/employee.entity';

/**
 * DTO update data karyawan. Field kredensial login (email/phone/password)
 * dan identitas (userId, employeeCode) TIDAK bisa diubah lewat endpoint ini
 * — perubahan akun login adalah tanggung jawab modul Auth.
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsUUID('4', { message: 'branchId harus UUID valid' })
  branchId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'departmentId harus UUID valid' })
  departmentId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'positionId harus UUID valid' })
  positionId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'managerId harus UUID valid' })
  managerId?: string;

  @IsOptional()
  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik?: string;

  @IsOptional()
  @Matches(/^\d{15,16}$/, { message: 'NPWP harus 15-16 digit angka' })
  npwp?: string;

  @IsOptional()
  @Matches(/^\d{6,20}$/, { message: 'Nomor rekening harus berupa angka (6-20 digit)' })
  bankAccountNo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bankName?: string;

  @IsOptional()
  @IsEnum(EmploymentType, { message: 'employmentType tidak valid' })
  employmentType?: EmploymentType;

  @IsOptional()
  @IsDateString({}, { message: 'resignDate harus format tanggal YYYY-MM-DD' })
  resignDate?: string;

  @IsOptional()
  @IsEnum(MaritalStatus, { message: 'maritalStatus tidak valid' })
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  dependentsCount?: number;

  @IsOptional()
  @IsEnum(EmployeeStatus, { message: 'status tidak valid' })
  status?: EmployeeStatus;
}
