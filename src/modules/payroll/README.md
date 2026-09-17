# Payroll Module

Payroll & Kepatuhan Regulasi (roadmap Phase 4): generate gaji bulanan
(BPJS, PPh21 TER, lembur, potongan unpaid leave), approval periode, dan
perhitungan THR.

## Dependency

- **Impor**: `EmployeeModule` (daftar employee aktif + data PTKP),
  `AttendanceModule` (jam lembur dari `overtime_requests` APPROVED),
  `LeaveModule` (hari unpaid leave) — baca lintas modul lewat repository
  interface masing-masing (Dependency Inversion), TIDAK mengakses tabel
  `overtime_requests`/`leave_requests` langsung.
- **Diekspor**: `PAYROLL_REPOSITORY` (`IPayrollRepository`) — dipakai
  `ReportsModule` (rekap payroll) dan `NotificationModule` (ambil daftar
  `payroll_items` satu periode untuk notifikasi "slip gaji sudah
  digenerate", lihat README-nya).
- **Event yang dipancarkan**: `payroll.generated` — didengarkan
  `NotificationModule`.

## Pattern

- **Strategy Pattern** (`calculators/`): `OvertimeCalculator`
  (`IOvertimeCalculator`), `BpjsCalculator` (`IBpjsCalculator`),
  `Pph21Calculator` (`ITaxCalculator`), `ThrCalculator` (`IThrCalculator`)
  — masing-masing class terpisah, tidak digabung dalam satu fungsi besar.
- **Factory Pattern**: `PayrollCalculatorFactory.getCalculator(employmentType)`
  → `MonthlySalaryPayrollCalculator` (PKWTT/PKWT/MAGANG) atau
  `DailyWagePayrollCalculator` (HARIAN); keduanya extend
  `BasePayrollCalculator` (Template Method, wiring Overtime→BPJS→PPh21→Net
  konsisten).
- **Unit of Work**: `generate()` dibungkus SATU transaction; `approve()`
  juga (payroll_periods + audit_logs sekaligus).
- `PayslipPdfGenerator` (Single Responsibility) — murni tata letak PDF,
  dipisah dari `PayrollService` yang mengurus data/DB. `pdfkit` dipilih
  karena pure-JS (tanpa native binding/Chromium), aman di
  `node:20-alpine`.
- `SeveranceCalculator` (Strategy) — Uang Pesangon (UP) & Uang Penghargaan
  Masa Kerja (UPMK) DASAR (dalam bulan upah) dihitung dari masa kerja
  sesuai PP 35/2021 Pasal 40 (tabel objektif, sama untuk semua alasan
  PHK). Multiplier UP/UPMK (0x/0.5x/1x/1.75x/2x/dst, berbeda per alasan
  PHK — efisiensi, tutup krn rugi, pensiun, meninggal dunia, mengundurkan
  diri, kesalahan berat, dst) **WAJIB diisi caller**, TIDAK ditebak
  otomatis dari `reason` (field itu murni catatan audit, bukan input
  perhitungan) — lihat komentar di kode & disclaimer roadmap-aplikasi-hr.md
  ("validasikan angka final dengan konsultan pajak/HR profesional").
- Semua tarif (BPJS/PTKP/TER) dibaca dari tabel by `effective_date`/
  `effective_year` — TIDAK ADA angka tarif hardcode di kode.
- Idempotency: `payroll_periods.status` (hanya generate dari `DRAFT`) +
  constraint `UNIQUE(payroll_period_id, employee_id)` sebagai lapisan
  kedua.

## Endpoint

| Endpoint | Role |
|---|---|
| `POST /payroll/generate`, `GET /payroll/:id/detail`, `PUT /payroll/:id/approve` | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `GET /payroll/periods?companyId=` | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `GET /payroll/thr/:employeeId` | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `GET /payroll/pph21-annual-reconciliation?employeeId=&year=` | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `GET /payroll/items/:payrollItemId/payslip` (generate-jika-belum-ada + unduh PDF) | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `POST /payroll/severance` (hitung pesangon, append-only) | SUPER_ADMIN, HR_ADMIN saja — keputusan HR/legal, FINANCE tidak boleh |
| `GET /payroll/severance?employeeId=` (riwayat perhitungan) | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `GET /payroll/salary-components`, `GET /payroll/salary-structures`, `GET /payroll/bpjs-settings`, `GET /payroll/ptkp-settings`, `GET /payroll/ter-rates` | SUPER_ADMIN, HR_ADMIN, FINANCE (baca) |
| `POST` versi endpoint di atas (buat entry baru) | SUPER_ADMIN, HR_ADMIN saja — FINANCE tidak boleh ubah tarif/komponen gaji |

## Catatan / keterbatasan yang diketahui (lihat juga komentar di kode)

- Jam lembur dihitung dari `overtime_requests` berstatus APPROVED dalam
  rentang tanggal periode (`PayrollService.computeOvertimeHours`) — bukan
  lagi diturunkan dari selisih `work_duration_minutes` vs jadwal shift.
- Hari kerja per bulan diasumsikan 6 hari/minggu (Senin–Sabtu); hari libur
  nasional (`holidays`) belum dikecualikan dari pembagi ini.
- Rekonsiliasi tahunan PPh21 (`GET /payroll/pph21-annual-reconciliation`)
  sudah ada — `Pph21AnnualReconciliationCalculator` menghitung total pajak
  progresif Pasal 17 UU PPh (5 lapis, hardcode SENGAJA — struktur UU itu
  sendiri, sama alasannya dengan `ThrCalculator`, BUKAN tarif yang
  berubah per periode) atas total gross setahun (SUM `payroll_items`
  lintas periode), lalu dibandingkan dengan total TER yang sudah dipotong
  bulanan. **Read-only** — TIDAK menulis ke `payroll_items` manapun; HR
  yang menerapkan `decemberAdjustment` secara manual ke slip Desember.
  Tetap validasikan dengan konsultan pajak sebelum dipakai produksi
  (disclaimer roadmap-aplikasi-hr.md).
- Slip gaji PDF sudah ada (`payslips`, disk lokal — belum ada kredensial
  S3/MinIO, sama seperti dokumen karyawan). Export CSV bank & laporan
  e-Bupot/BPJS (roadmap Phase 4 & 5) belum ada — di luar cakupan yang
  sudah dikerjakan.
- Self-service unduh slip gaji pribadi (karyawan lihat slip sendiri)
  SENGAJA tidak dibuat di sini — itu bagian mobile app (di luar cakupan
  pengerjaan ini). Endpoint yang ada hanya untuk HR/Finance/Super Admin.
- `salary_components`/`employee_salary_structures`/`bpjs_settings`/
  `tax_ptkp_settings`/`tax_ter_rates` kini punya endpoint create+list
  (bukan lagi migration/SQL manual — dipakai dashboard `hr-admin-dashboard`
  halaman "Payroll Settings"). Sengaja **create-only, tidak ada update/
  delete**: entry lama otomatis ditutup (`endDate`) saat entry baru dibuat
  untuk `employee_salary_structures`, sesuai checklist §8 dashboard
  "tidak pernah overwrite data lama". `bpjs_settings`/`tax_ptkp_settings`/
  `tax_ter_rates` juga create-only by design (histori per tanggal/tahun
  berlaku) — masih tetap perlu diisi manual pertama kali sebelum payroll
  bisa digenerate (lihat `test-plan-hr.md` §2.2), tapi sekarang lewat API,
  bukan SQL.
