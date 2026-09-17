# Reports Module

Laporan ringkasan (roadmap Phase 5): attendance summary, leave summary,
payroll summary.

## Dependency

- **Impor**: `EmployeeModule`, `AttendanceModule`, `LeaveModule`,
  `PayrollModule` — hanya untuk repository interface (`EMPLOYEE_REPOSITORY`/
  `ATTENDANCE_REPOSITORY`/`LEAVE_REPOSITORY`/`PAYROLL_REPOSITORY`) yang
  sudah diekspor masing-masing modul.
- **Tidak punya entity/repository/migration sendiri** — modul ini murni
  lapisan agregasi lintas modul, TIDAK mengakses tabel `attendances`/
  `leave_*`/`payroll_*` langsung.
- **Tidak mengekspor apa pun** (belum ada modul yang perlu baca hasil
  agregasi Reports).

## Pattern

Tetap Repository Pattern (§3) — hanya saja "repository" yang dipakai
adalah interface milik modul LAIN (Dependency Inversion lintas modul,
persis seperti cara `PayrollService` membaca data Attendance/Leave).

Query per-karyawan (bukan satu `GROUP BY` lintas company) dipilih SENGAJA
untuk attendance & leave supaya menembak composite index
`(employee_id, attendance_date)` dan `(employee_id, status)` (§5
"Indexing penting"), bukan full/partial scan.

## Endpoint

| Endpoint | Role |
|---|---|
| `GET /reports/attendance-summary`, `/leave-summary` | SUPER_ADMIN, HR_ADMIN, MANAGER |
| `GET /reports/payroll-summary` | SUPER_ADMIN, HR_ADMIN, FINANCE |

## Catatan

- Dashboard HR/Finance (headcount, turnover, grafik tren), export
  Excel/PDF, dan laporan e-Bupot/BPJS (roadmap Phase 5) BELUM termasuk di
  sini — modul ini dibatasi ke 3 laporan ringkasan yang sudah diminta.
- Untuk company yang jauh lebih besar dari yang ditargetkan roadmap ini,
  query per-karyawan bisa jadi bottleneck — solusinya adalah tabel
  agregat/materialized view, di luar skema §5.5 saat ini sehingga belum
  ditambahkan.
