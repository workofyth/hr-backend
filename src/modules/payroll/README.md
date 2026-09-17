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
  `ReportsModule` (rekap payroll).
- **Event yang dipancarkan**: `payroll.generated` — belum ada listener
  (menyusul bersama fitur generate PDF slip via job queue).

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
- Semua tarif (BPJS/PTKP/TER) dibaca dari tabel by `effective_date`/
  `effective_year` — TIDAK ADA angka tarif hardcode di kode.
- Idempotency: `payroll_periods.status` (hanya generate dari `DRAFT`) +
  constraint `UNIQUE(payroll_period_id, employee_id)` sebagai lapisan
  kedua.

## Endpoint

| Endpoint | Role |
|---|---|
| `POST /payroll/generate`, `GET /payroll/:id/detail`, `PUT /payroll/:id/approve` | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `GET /payroll/thr/:employeeId` | SUPER_ADMIN, HR_ADMIN, FINANCE |
| `GET /payroll/salary-components`, `GET /payroll/salary-structures`, `GET /payroll/bpjs-settings`, `GET /payroll/ptkp-settings`, `GET /payroll/ter-rates` | SUPER_ADMIN, HR_ADMIN, FINANCE (baca) |
| `POST` versi endpoint di atas (buat entry baru) | SUPER_ADMIN, HR_ADMIN saja — FINANCE tidak boleh ubah tarif/komponen gaji |

## Catatan / keterbatasan yang diketahui (lihat juga komentar di kode)

- Jam lembur dihitung dari `overtime_requests` berstatus APPROVED dalam
  rentang tanggal periode (`PayrollService.computeOvertimeHours`) — bukan
  lagi diturunkan dari selisih `work_duration_minutes` vs jadwal shift.
- Hari kerja per bulan diasumsikan 6 hari/minggu (Senin–Sabtu); hari libur
  nasional (`holidays`) belum dikecualikan dari pembagi ini.
- Rekonsiliasi tahunan PPh21 (Desember, metode progresif) belum
  diimplementasikan — hanya TER bulanan.
- Slip gaji PDF, export CSV bank, dan laporan e-Bupot/BPJS (roadmap Phase 4
  & 5) belum ada — di luar cakupan yang sudah dikerjakan.
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
