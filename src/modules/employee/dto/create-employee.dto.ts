import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { EmploymentType, MaritalStatus } from '../entities/employee.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * DTO pembuatan karyawan baru. Sekaligus membuat akun login (`users`) karena
 * `employees.user_id` NOT NULL (§5.2) dan belum ada endpoint registrasi
 * terpisah pada Phase 1 ini — lihat EmployeeService.create().
 */
export class CreateEmployeeDto {
  // --- Kredensial akun login (tabel users) ---
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @Matches(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, {
    message: 'Format nomor HP tidak valid (contoh: 08123456789)',
  })
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  password: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role tidak valid' })
  role?: UserRole;

  // --- Data karyawan (tabel employees) ---
  @IsString()
  @IsNotEmpty({ message: 'Kode karyawan wajib diisi' })
  employeeCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  fullName: string;

  @IsUUID('4', { message: 'companyId harus UUID valid' })
  companyId: string;

  @IsUUID('4', { message: 'branchId harus UUID valid' })
  branchId: string;

  @IsUUID('4', { message: 'departmentId harus UUID valid' })
  departmentId: string;

  @IsUUID('4', { message: 'positionId harus UUID valid' })
  positionId: string;

  @IsOptional()
  @IsUUID('4', { message: 'managerId harus UUID valid' })
  managerId?: string;

  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik: string;

  @IsOptional()
  @Matches(/^\d{15,16}$/, { message: 'NPWP harus 15-16 digit angka' })
  npwp?: string;

  @Matches(/^\d{6,20}$/, { message: 'Nomor rekening harus berupa angka (6-20 digit)' })
  bankAccountNo: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama bank wajib diisi' })
  bankName: string;

  @IsEnum(EmploymentType, { message: 'employmentType tidak valid' })
  employmentType: EmploymentType;

  @IsDateString({}, { message: 'joinDate harus format tanggal YYYY-MM-DD' })
  joinDate: string;

  @IsEnum(MaritalStatus, { message: 'maritalStatus tidak valid' })
  maritalStatus: MaritalStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  dependentsCount?: number;
}
