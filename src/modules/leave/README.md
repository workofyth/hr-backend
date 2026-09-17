# Leave Module

Pengajuan Cuti & Izin (roadmap Phase 3): validasi saldo, approval
berjenjang (atasan → HR), auto-update saldo, dan integrasi status
`ON_LEAVE` ke Attendance.

## Dependency

- **Impor**: `EmployeeModule` (`EMPLOYEE_REPOSITORY`) — `managerId` untuk
  level approval 1, resolve HR_ADMIN untuk level approval 2.
- **Diekspor**: `LEAVE_REPOSITORY` (`ILeaveRepository`) — dipakai
  `PayrollModule` (potongan unpaid leave) dan `ReportsModule` (saldo/rekap
  cuti).
- **Event yang dipancarkan**: `leave.approved`, `leave.cancelled` —
  didengarkan `AttendanceModule` (lihat README-nya) untuk menandai/
  membatalkan `ON_LEAVE`, TANPA modul ini meng-import `AttendanceModule`.
  `leave.rejected` — didengarkan `NotificationModule` untuk memberitahu
  karyawan pengaju (payload sudah bawa `userId` langsung, lihat
  `LeaveRejectedEvent`).

## Pattern

- Repository Pattern: satu `LeaveRepository` untuk 4 tabel §5.4
  (`leave_types`, `leave_balances`, `leave_requests`, `leave_approvals`).
- **Chain of Responsibility** (`approval/`): `ManagerApprovalHandler` →
  `HrApprovalHandler`, dirangkai `LeaveApprovalChainFactory` (Factory
  Pattern). Menambah level approval baru = tambah handler, tanpa mengubah
  `LeaveService`.
- Unit of Work: transaction untuk `apply()`/`approve()`/`reject()`/`cancel()`
  (leave_requests + leave_approvals + leave_balances sekaligus).
- Audit log: `APPROVE_LEAVE_REQUEST`/`REJECT_LEAVE_REQUEST`/
  `CANCEL_LEAVE_REQUEST` (checklist §7), ditulis DALAM transaction yang
  sama lewat `AuditLogService`.

## Endpoint

| Endpoint | Role |
|---|---|
| `GET /leave-types`, `GET /leave-balance`, `GET /leave-requests` | Self-service |
| `POST /leave-requests`, `PUT /leave-requests/:id/cancel` | Self-service |
| `GET /leave-approvals/pending` | SUPER_ADMIN, HR_ADMIN, MANAGER | Antrian approval (admin-dashboard-web-hr.md §5) — hanya baris `leave_approvals` yang levelnya = `currentApprovalLevel` request-nya (benar-benar actionable) |
| `PUT /leave-requests/:id/approve`, `/reject` | SUPER_ADMIN, HR_ADMIN, MANAGER |

## Catatan

- `leave_types` & `salary`-independent — data referensi diisi lewat
  migration/SQL manual (belum ada CRUD), sama seperti `organization`.
- Level approval HR (level 2) resolve HR_ADMIN PERTAMA di company yang
  sama saat pengajuan dibuat, tapi approver aktual boleh HR_ADMIN/Super
  Admin manapun saat ini (override, bukan harus orang yang sama).
