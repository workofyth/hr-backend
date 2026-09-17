import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Self-service profile (roadmap Phase 1: "karyawan bisa lihat & update data
 * terbatas"). Hanya field non-kritis yang boleh diubah karyawan sendiri —
 * identitas (NIK/NPWP/employeeCode), struktur organisasi, dan kredensial
 * login tetap eksklusif milik HR_ADMIN/SUPER_ADMIN lewat `PUT /employees/:id`.
 */
export class UpdateMyProfileDto {
  @IsOptional()
  @Matches(/^\d{6,20}$/, { message: 'Nomor rekening harus berupa angka (6-20 digit)' })
  bankAccountNo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bankName?: string;
}
