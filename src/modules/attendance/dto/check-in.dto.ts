import { IsDateString, IsLatitude, IsLongitude, IsNumber, IsOptional, IsPositive, IsUrl } from 'class-validator';

/**
 * DTO check-in — roadmap-aplikasi-hr.md Phase 2.
 * `deviceTimestamp` dipakai untuk deteksi anomali jam device vs server
 * (§6); `latitude`/`longitude`/`accuracyMeters` divalidasi ulang di server
 * lewat GeofenceValidationStrategy — TIDAK PERNAH dipercaya dari client.
 */
export class CheckInDto {
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

  @IsOptional()
  @IsUrl({}, { message: 'checkInPhotoUrl harus URL valid' })
  photoUrl?: string;
}
