import { IsDateString, IsLatitude, IsLongitude, IsNumber, IsOptional, IsPositive } from 'class-validator';

/**
 * DTO check-out — sama seperti CheckInDto (§6), tanpa foto (schema
 * `attendances` tidak punya kolom `check_out_photo_url`).
 */
export class CheckOutDto {
  @IsLatitude({ message: 'latitude tidak valid' })
  latitude: number;

  @IsLongitude({ message: 'longitude tidak valid' })
  longitude: number;

  @IsOptional()
  @IsNumber()
  @IsPositive({ message: 'accuracyMeters harus lebih dari 0' })
  accuracyMeters?: number;

  @IsDateString({}, { message: 'deviceTimestamp harus format ISO 8601' })
  deviceTimestamp: string;
}
