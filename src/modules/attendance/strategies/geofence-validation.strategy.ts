import { Injectable } from '@nestjs/common';
import { haversineDistanceMeters } from '../../../common/utils/haversine.util';

export interface GeofencePoint {
  latitude: number;
  longitude: number;
}

export interface GeofenceTarget {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface GeofenceValidationResult {
  distanceMeters: number;
  isWithinRadius: boolean;
}

/**
 * Strategy Pattern — backend-architecture-hr.md §3: aturan radius sering
 * berubah per kebijakan cabang, jadi diisolasi di satu class agar mudah
 * diganti/ditambah tanpa mengubah AttendanceService.
 *
 * PENTING (§6 & roadmap Phase 2 "Detail Teknis Radius"): jarak SELALU
 * dihitung ulang di sini dari koordinat GPS yang dikirim client, memakai
 * titik & radius cabang yang tersimpan di database. Server tidak pernah
 * memakai jarak/status "dalam radius" yang dihitung/dikirim oleh client.
 */
@Injectable()
export class GeofenceValidationStrategy {
  validate(point: GeofencePoint, target: GeofenceTarget): GeofenceValidationResult {
    const distanceMeters = haversineDistanceMeters(
      point.latitude,
      point.longitude,
      target.latitude,
      target.longitude,
    );

    return {
      distanceMeters: Math.round(distanceMeters * 100) / 100,
      isWithinRadius: distanceMeters <= target.radiusMeters,
    };
  }
}
