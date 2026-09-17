import { GeofenceValidationStrategy } from './geofence-validation.strategy';

describe('GeofenceValidationStrategy', () => {
  let strategy: GeofenceValidationStrategy;

  // Kantor pusat contoh: Monas, Jakarta.
  const office = { latitude: -6.1753924, longitude: 106.8271528, radiusMeters: 100 };

  beforeEach(() => {
    strategy = new GeofenceValidationStrategy();
  });

  it('menganggap valid saat titik user persis sama dengan titik kantor (jarak 0m)', () => {
    const result = strategy.validate(
      { latitude: office.latitude, longitude: office.longitude },
      office,
    );

    expect(result.distanceMeters).toBe(0);
    expect(result.isWithinRadius).toBe(true);
  });

  it('menganggap valid saat user berada jauh di dalam radius (~11m)', () => {
    // ~0.0001 derajat lintang ~= 11.1m.
    const result = strategy.validate(
      { latitude: office.latitude + 0.0001, longitude: office.longitude },
      office,
    );

    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.distanceMeters).toBeLessThan(office.radiusMeters);
    expect(result.isWithinRadius).toBe(true);
  });

  it('menganggap valid tepat di batas radius (edge case: distance === radius)', () => {
    // Geser lurus ke utara sejauh persis radiusMeters, memakai pendekatan
    // derajat lintang (1 derajat lintang ~= 111.320m, cukup akurat untuk
    // jarak pendek seperti radius kantor).
    const metersPerDegreeLat = 111320;
    const offsetDegrees = office.radiusMeters / metersPerDegreeLat;

    const result = strategy.validate(
      { latitude: office.latitude + offsetDegrees, longitude: office.longitude },
      office,
    );

    expect(result.distanceMeters).toBeCloseTo(office.radiusMeters, 0);
    expect(result.isWithinRadius).toBe(true);
  });

  it('menolak (di luar radius) saat user sedikit melewati batas radius', () => {
    const metersPerDegreeLat = 111320;
    // Geser 20m lebih jauh dari radius supaya pasti melewati batas,
    // menghindari flaky test akibat pembulatan approximation derajat->meter.
    const offsetDegrees = (office.radiusMeters + 20) / metersPerDegreeLat;

    const result = strategy.validate(
      { latitude: office.latitude + offsetDegrees, longitude: office.longitude },
      office,
    );

    expect(result.distanceMeters).toBeGreaterThan(office.radiusMeters);
    expect(result.isWithinRadius).toBe(false);
  });

  it('menolak saat user berada jauh di luar radius (~1km, mis. GPS di cabang lain)', () => {
    const result = strategy.validate(
      { latitude: office.latitude + 0.009, longitude: office.longitude },
      office,
    );

    expect(result.distanceMeters).toBeGreaterThan(900);
    expect(result.isWithinRadius).toBe(false);
  });

  it('menghitung jarak untuk perbedaan longitude (bukan cuma latitude)', () => {
    const result = strategy.validate(
      { latitude: office.latitude, longitude: office.longitude + 0.01 },
      office,
    );

    expect(result.distanceMeters).toBeGreaterThan(office.radiusMeters);
    expect(result.isWithinRadius).toBe(false);
  });

  it('menghormati radiusMeters custom per cabang (radius besar tetap valid untuk jarak yang sama)', () => {
    const wideRadiusBranch = { ...office, radiusMeters: 5000 };

    const result = strategy.validate(
      { latitude: office.latitude + 0.009, longitude: office.longitude },
      wideRadiusBranch,
    );

    expect(result.isWithinRadius).toBe(true);
  });
});
