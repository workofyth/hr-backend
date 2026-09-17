# Notification Module

Notifikasi in-app (§5.6 `notifications`). Saat ini hanya mendengarkan
event `attendance.checked_in` dan menyimpan baris notifikasi — belum ada
pengiriman lewat channel eksternal (push/email).

## Dependency

- **Tidak meng-import modul lain** — hanya bergantung pada nama event
  (`ATTENDANCE_CHECKED_IN_EVENT`) & tipe payload (`AttendanceCheckedInEvent`)
  yang diekspor `AttendanceModule`, tanpa meng-import module-nya (Observer
  Pattern, decoupled — lihat §3 & §6).
- **Tidak mengekspor apa pun.**
- Tidak punya controller — modul ini murni event listener + penyimpanan
  baris `notifications`, tidak ada endpoint HTTP.

## Pattern

- Observer/Event-driven: `@OnEvent(ATTENDANCE_CHECKED_IN_EVENT)` di
  `NotificationService`, best-effort (kegagalan di sini TIDAK boleh
  menggagalkan proses check-in yang sudah tercatat — di-try/catch +
  logger, bukan dilempar ulang).
- `channels/push.channel.ts` & `channels/email.channel.ts` — placeholder
  Strategy Pattern untuk provider eksternal (FCM/SMTP), BELUM
  diimplementasikan (menyusul saat integrasi provider tersedia, lihat
  `.env.example`).

## Catatan

- Belum mendengarkan event `leave.approved`/`payroll.generated` (roadmap
  menyebut "Notifikasi status pengajuan cuti" & kirim slip gaji) —
  di luar cakupan yang sudah dikerjakan sejauh ini.
