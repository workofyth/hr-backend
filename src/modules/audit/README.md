# Audit Module

Audit log viewer read-only (admin-dashboard-web-hr.md) di atas tabel
`audit_logs` (§5.6) — checklist §7: "Ada audit log untuk perubahan data
gaji & approval, siapa mengubah apa dan kapan".

## Dependency

- Tidak mengimpor modul lain. `AuditLogService` (cross-cutting,
  `common/services/`) sudah dipakai `AttendanceModule`/`LeaveModule`/
  `PayrollModule` masing-masing untuk MENULIS (`record()`) — modul ini
  hanya menambahkan jalur BACA (`findAll()`) lewat controller sendiri,
  tidak mengambil alih penulisan dari modul-modul tersebut.

## Endpoint

| Endpoint | Role |
|---|---|
| `GET /audit-logs?userId=&action=&entityType=&entityId=&dateFrom=&dateTo=&page=&limit=` | SUPER_ADMIN, HR_ADMIN |

Semua filter opsional. `dateFrom`/`dateTo` (format `YYYY-MM-DD`) harus
diisi berpasangan — `dateTo` inklusif seluruh hari itu (`23:59:59.999`),
bukan cut-off tengah malam.

## Catatan

- Read-only murni — tidak ada endpoint create/update/delete di sini;
  `audit_logs` bersifat append-only (checklist §7), ditulis eksklusif
  lewat `AuditLogService.record()` dari modul lain.
