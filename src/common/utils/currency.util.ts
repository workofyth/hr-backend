/**
 * Util mata uang untuk payroll (roadmap-aplikasi-hr.md Phase 4). Semua
 * angka uang di kolom DB wajib DECIMAL, bukan FLOAT (checklist §7
 * backend-architecture-hr.md) — kolom TypeORM `decimal` dibaca/ditulis
 * sebagai string. Util ini hanya menjembatani aritmetika `number` di
 * memori (Strategy calculator) dengan representasi string presisi-2
 * yang disimpan ke DB, TIDAK pernah menyimpan hasil kalkulasi sebagai
 * `float` di kolom database.
 */

/** Rupiah tidak punya sen — pembulatan akhir selalu ke rupiah penuh. */
export function roundToRupiah(value: number): number {
  return Math.round(value);
}

/** Format angka menjadi string presisi-2 untuk kolom `decimal(x,2)`. */
export function toDecimalString(value: number): string {
  return roundToRupiah(value).toFixed(2);
}

/** Parse kolom `decimal` (selalu dibaca TypeORM sebagai string) ke number. */
export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}
