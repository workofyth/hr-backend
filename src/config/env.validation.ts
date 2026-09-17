import * as Joi from 'joi';

/**
 * Skema validasi environment variable saat boot (fail fast).
 * Sesuai backend-architecture-hr.md §4: "Environment config: tidak ada
 * credential/hardcode di kode. Semua lewat .env + validasi schema env
 * saat boot (fail fast jika env tidak lengkap)."
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  APP_PORT: Joi.number().port().default(3000),
  APP_URL: Joi.string().uri().required(),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_DATABASE: Joi.string().required(),
  DB_SCHEMA: Joi.string().default('public'),
  DB_SSL: Joi.boolean().default(false),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Kunci enkripsi at-rest untuk data sensitif karyawan (nik, npwp,
  // bank_account_no) — lihat src/common/utils/encryption.util.ts.
  ENCRYPTION_KEY: Joi.string().min(16).required(),

  // Absensi Radius/Geofencing (Phase 2) — lihat
  // src/modules/attendance/strategies/geofence-validation.strategy.ts.
  ATTENDANCE_MAX_GPS_ACCURACY_METERS: Joi.number().positive().default(50),
  ATTENDANCE_MAX_CLOCK_SKEW_SECONDS: Joi.number().positive().default(300),
});
