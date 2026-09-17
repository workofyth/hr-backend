import { IsDateString, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

/**
 * DTO perhitungan pesangon/PHK (PP 35/2021, roadmap Phase 4). Multiplier
 * UP/UPMK WAJIB diisi caller (HR/legal) sesuai alasan PHK sebenarnya —
 * lihat catatan di `SeveranceCalculator`. `reason` murni field pencatatan
 * (audit trail), tidak dipakai untuk menentukan multiplier secara otomatis.
 */
export class CalculateSeveranceDto {
  @IsUUID()
  employeeId: string;

  @IsDateString({}, { message: 'terminationDate harus format tanggal YYYY-MM-DD' })
  terminationDate: string;

  @IsNotEmpty({ message: 'reason wajib diisi (mis. "Efisiensi - perusahaan tutup karena rugi")' })
  reason: string;

  @IsNumber()
  @Min(0)
  severancePayMultiplier: number;

  @IsNumber()
  @Min(0)
  serviceAppreciationMultiplier: number;

  @IsNumber()
  @Min(0)
  compensationPay: number;
}
