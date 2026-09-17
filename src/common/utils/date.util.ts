/**
 * Util tanggal/waktu — roadmap-aplikasi-hr.md §0: "Server waktu: gunakan UTC
 * di DB, tampilkan WIB/WITA/WIT di UI." Backend selalu bekerja dalam UTC;
 * konversi ke zona waktu lokal murni tanggung jawab presentation layer
 * (mobile app / admin dashboard), bukan backend.
 */

/** Format `Date` menjadi tanggal murni (kolom `date`, UTC) — "YYYY-MM-DD". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Gabungkan tanggal ("YYYY-MM-DD") dengan jam shift (kolom `time`, mis.
 * "08:00:00") menjadi satu `Date` UTC. Konsisten dengan kebijakan "UTC di
 * DB" — jam shift (`shifts.start_time`/`end_time`) diasumsikan sudah
 * disimpan dalam UTC oleh Admin saat setup data referensi.
 */
export function combineDateAndTimeUtc(date: string, time: string): Date {
  return new Date(`${date}T${time}Z`);
}
