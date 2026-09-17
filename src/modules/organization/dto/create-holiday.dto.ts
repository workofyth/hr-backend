import { IsBoolean, IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateHolidayDto {
  @IsUUID()
  companyId: string;

  @IsDateString({}, { message: 'date harus format tanggal YYYY-MM-DD' })
  date: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama hari libur wajib diisi' })
  name: string;

  @IsBoolean()
  isNational: boolean;
}
