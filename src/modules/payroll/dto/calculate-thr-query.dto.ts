import { IsDateString } from 'class-validator';

export class CalculateThrQueryDto {
  @IsDateString({}, { message: 'referenceDate harus format tanggal YYYY-MM-DD' })
  referenceDate: string;
}
