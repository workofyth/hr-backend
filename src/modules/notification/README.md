# Notification Module

Notifikasi in-app (§5.6 `notifications`). Mendengarkan `attendance.checked_in`,
`leave.rejected`, dan `payroll.generated`, lalu menyimpan baris notifikasi —
belum ada pengiriman lewat channel eksternal (push/email).

## Dependency

- **Impor**: `EmployeeModule` (`EMPLOYEE_REPOSITORY` — resolve `employeeId`
  ke `userId` untuk event `payroll.generated`, yang hanya bawa
  `payrollPeriodId`/`payrollItemIds`) dan `PayrollModule`
  (`PAYROLL_REPOSITORY` — ambil daftar `payroll_items` satu periode).
  Event `attendance.checked_in`/`leave.rejected` sudah bawa `userId`
  langsung di payload-nya, tidak butuh modul lain untuk itu.
- Bergantung pada nama event & tipe payload yang diekspor
  `AttendanceModule`/`LeaveModule`/`PayrollModule`, TANPA meng-import
  module-nya untuk keperluan event itu sendiri (Observer Pattern,
  decoupled — lihat §3 & §6). Import `EmployeeModule`/`PayrollModule` di
  atas murni untuk keperluan ENRICHMENT data (resolve userId, ambil daftar
  item), bukan untuk mendengarkan event.
- **Tidak mengekspor apa pun.**
- Tidak punya controller — modul ini murni event listener + penyimpanan
  baris `notifications`, tidak ada endpoint HTTP.

## Pattern

- Observer/Event-driven: `@OnEvent(...)` per event di `NotificationService`,
  semua best-effort (kegagalan di sini TIDAK boleh menggagalkan proses
  yang sudah tercatat di modul penerbit — di-try/catch + logger, bukan
  dilempar ulang).
- `channels/push.channel.ts` & `channels/email.channel.ts` — placeholder
  Strategy Pattern untuk provider eksternal (FCM/SMTP), BELUM
  diimplementasikan (menyusul saat integrasi provider tersedia, lihat
  `.env.example`).

## Event yang didengarkan

| Event | Sumber | Isi notifikasi |
|---|---|---|
| `attendance.checked_in` | AttendanceModule | Status check-in (tepat waktu/terlambat/dst) |
| `leave.rejected` | LeaveModule | Rentang tanggal cuti + alasan penolakan (jika ada) |
| `payroll.generated` | PayrollModule | Satu notifikasi per employee yang punya `payroll_item` pada periode itu |

## Catatan

- Belum mendengarkan `leave.approved`/`leave.cancelled` — di luar cakupan
  yang sudah dikerjakan sejauh ini (bisa ditambah dengan pola yang sama
  jika dibutuhkan; `LeaveApprovedEvent` hanya bawa `employeeId`, perlu
  resolve ke `userId` seperti `payroll.generated`).
