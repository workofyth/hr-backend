/**
 * Loader konfigurasi aplikasi dari environment variable.
 * Dipakai lewat ConfigService (@nestjs/config), tidak ada nilai hardcode.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.APP_PORT as string, 10),
  url: process.env.APP_URL,

  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string, 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    schema: process.env.DB_SCHEMA,
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  attendance: {
    // roadmap-aplikasi-hr.md Phase 2 "Detail Teknis Radius": "Toleransi
    // akurasi GPS (misal terima jika akurasi device < 50m)".
    maxGpsAccuracyMeters: parseInt(process.env.ATTENDANCE_MAX_GPS_ACCURACY_METERS as string, 10),
    // Deteksi anomali dasar: tolak absen jika jam perangkat menyimpang
    // terlalu jauh dari jam server (indikasi jam device diubah manual).
    maxClockSkewSeconds: parseInt(process.env.ATTENDANCE_MAX_CLOCK_SKEW_SECONDS as string, 10),
  },

  // Rate limiting (roadmap Phase 6 "Keamanan") — `ttlMs` dikonversi ke
  // milidetik sekali di sini karena @nestjs/throttler v5 menerima ttl
  // dalam ms, sementara .env tetap dalam detik agar mudah dibaca operator.
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_SECONDS as string, 10) * 1000,
    limit: parseInt(process.env.THROTTLE_LIMIT as string, 10),
  },

  // CORS — origin dashboard web (hr-admin-dashboard), lihat main.ts.
  corsOrigins: (process.env.CORS_ORIGINS as string).split(',').map((origin) => origin.trim()),
});
