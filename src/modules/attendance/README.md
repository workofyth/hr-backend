# Attendance Module

Absensi berbasis radius/geofencing (roadmap Phase 2): check-in/out dengan
validasi jarak SERVER-SIDE, deteksi anomali dasar, dan pengajuan koreksi
absensi dengan approval atasan.

## Dependency

- **Impor**: `EmployeeModule` (`EMPLOYEE_REPOSITORY`) — butuh data cabang
  (untuk geofence) dan `managerId` (untuk otorisasi approval koreksi).
- **Diekspor**: `ATTENDANCE_REPOSITORY` (`IAttendanceRepository`) — dipakai
  `PayrollModule` (turunan jam lembur) dan `ReportsModule` (rekap status
  per karyawan).
- **Event yang didengarkan** (Observer Pattern, decoupled — lihat
  `AttendanceService`): `leave.approved` & `leave.cancelled` dari
  `LeaveModule`, untuk menandai/membatalkan status `ON_LEAVE` pada tanggal
  terkait. Attendance TIDAK meng-import `LeaveModule` — hanya bergantung
  pada nama event & tipe payload event-nya.
- **Event yang dipancarkan**: `attendance.checked_in` — didengarkan
  `NotificationModule`.

## Pattern

- Repository Pattern: `AttendanceRepository` + `AttendanceCorrectionRepository`
  (dua repository terpisah — dua konsep berbeda per §5.3).
- Strategy Pattern: `GeofenceValidationStrategy` (rumus Haversine, validasi
  radius yang TIDAK PERNAH percaya perhitungan dari client).
- Unit of Work: transaction untuk `approveCorrection()` (menulis
  `attendances` + `attendance_corrections` sekaligus) dan `rejectCorrection()`
  (`attendance_corrections` + `audit_logs`).
- Audit log: `APPROVE_ATTENDANCE_CORRECTION`/`REJECT_ATTENDANCE_CORRECTION`
  (checklist §7), ditulis DALAM transaction yang sama lewat `AuditLogService`.

## Endpoint

| Endpoint | Role | Catatan |
|---|---|---|
| `POST /attendance/check-in`, `/check-out` | Self-service (semua role login) | Di-throttle 10/menit (Phase 6) |
| `GET /attendance/history` | Self-service | |
| `POST /attendance/correction-request` | Self-service | |
| `GET /attendance/corrections/pending` | SUPER_ADMIN, HR_ADMIN, MANAGER | Antrian approval (admin-dashboard-web-hr.md §5) — MANAGER hanya melihat anak buah langsungnya |
| `PUT /attendance/corrections/:id/approve`, `/reject` | SUPER_ADMIN, HR_ADMIN, MANAGER (atasan langsung) | |

## Catatan / keterbatasan yang diketahui

- Tabel `overtime_requests` (§5.3, "pengajuan lembur dengan approval")
  **belum pernah dibuat** di modul ini — `PayrollService` menurunkan jam
  lembur dari selisih `work_duration_minutes` vs jadwal shift, bukan dari
  pengajuan lembur terpisah (lihat catatan di `PayrollService`).
- Status `ABSENT` tidak pernah di-set otomatis oleh job terjadwal (tidak
  ada cron "tandai alpha jika tidak check-in") — hanya field enum yang
  tersedia di skema.
