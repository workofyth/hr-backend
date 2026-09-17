const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Jarak great-circle antara dua koordinat (meter) via formula Haversine.
 * Dipakai untuk validasi radius/geofencing absensi (roadmap-aplikasi-hr.md
 * Phase 2) — SELALU dihitung ulang di server, jangan percaya jarak yang
 * dikirim client (backend-architecture-hr.md §6).
 */
export function haversineDistanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const dLat = toRadians(latitude2 - latitude1);
  const dLon = toRadians(longitude2 - longitude1);
  const lat1Rad = toRadians(latitude1);
  const lat2Rad = toRadians(latitude2);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}
