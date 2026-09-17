# Attendance Module

Absensi berbasis radius/geofencing (roadmap Phase 2): check-in/out dengan
validasi jarak SERVER-SIDE, deteksi anomali dasar, dan pengajuan koreksi
absensi dengan approval atasan.

## Dependency

- **Impor**: `EmployeeModule` (`EMPLOYEE_REPOSITORY`) — butuh data cabang
  (untuk geofence) dan `managerId` (untuk otorisasi approval koreksi/lembur).
- **Diekspor**: `ATTENDANCE_REPOSITORY` (`IAttendanceRepository`, dipakai
  `ReportsModule` untuk rekap status per karyawan) dan
  `OVERTIME_REQUEST_REPOSITORY` (`IOvertimeRequestRepository`, dipakai
  `PayrollModule` sebagai basis jam lembur — lihat `PayrollService.computeOvertimeHours`).
- **Event yang didengarkan** (Observer Pattern, decoupled — lihat
  `AttendanceService`): `leave.approved` & `leave.cancelled` dari
  `LeaveModule`, untuk menandai/membatalkan status `ON_LEAVE` pada tanggal
  terkait. Attendance TIDAK meng-import `LeaveModule` — hanya bergantung
  pada nama event & tipe payload event-nya.
- **Event yang dipancarkan**: `attendance.checked_in` — didengarkan
  `NotificationModule`.

## Pattern

- Repository Pattern: `AttendanceRepository`, `AttendanceCorrectionRepository`,
  `OvertimeRequestRepository` (repository terpisah per konsep, §5.3).
- Strategy Pattern: `GeofenceValidationStrategy` (rumus Haversine, validasi
  radius yang TIDAK PERNAH percaya perhitungan dari client).
- Unit of Work: transaction untuk `approveCorrection()` (menulis
  `attendances` + `attendance_corrections` sekaligus), `rejectCorrection()`,
  `approveOvertime()`, `rejectOvertime()` (masing-masing + `audit_logs`), dan
  `assignShift()` (menutup penugasan lama + membuat penugasan baru).
- Audit log: `APPROVE_ATTENDANCE_CORRECTION`/`REJECT_ATTENDANCE_CORRECTION`
  dan `APPROVE_OVERTIME_REQUEST`/`REJECT_OVERTIME_REQUEST` (checklist §7),
  ditulis DALAM transaction yang sama lewat `AuditLogService`.

## Endpoint

| Endpoint | Role | Catatan |
|---|---|---|
| `POST /attendance/check-in`, `/check-out` | Self-service (semua role login) | Di-throttle 10/menit (Phase 6) |
| `GET /attendance/history` | Self-service | |
| `POST /attendance/correction-request` | Self-service | |
| `GET /attendance/corrections/pending` | SUPER_ADMIN, HR_ADMIN, MANAGER | Antrian approval (admin-dashboard-web-hr.md §5) — MANAGER hanya melihat anak buah langsungnya |
| `PUT /attendance/corrections/:id/approve`, `/reject` | SUPER_ADMIN, HR_ADMIN, MANAGER (atasan langsung) | |
| `POST /attendance/overtime-request` | Self-service | |
| `GET /attendance/overtime/pending` | SUPER_ADMIN, HR_ADMIN, MANAGER | Sama pola dengan antrian koreksi |
| `PUT /attendance/overtime/:id/approve`, `/reject` | SUPER_ADMIN, HR_ADMIN, MANAGER (atasan langsung) | |
| `GET /attendance/shift-assignments?employeeId=` | SUPER_ADMIN, HR_ADMIN | Riwayat penugasan shift satu karyawan |
| `POST /attendance/shift-assignments` | SUPER_ADMIN, HR_ADMIN | Penugasan lama (endDate null) otomatis ditutup, bukan overwrite |

## Catatan / keterbatasan yang diketahui

- Status `ABSENT` tidak pernah di-set otomatis oleh job terjadwal (tidak
  ada cron "tandai alpha jika tidak check-in") — hanya field enum yang
  tersedia di skema.
