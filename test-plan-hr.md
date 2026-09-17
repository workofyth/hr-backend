# Test Plan End-to-End — Aplikasi HR Mandiri (Phase 6)

Dokumen pendamping dari `roadmap-aplikasi-hr.md` (checklist Phase 6 — Testing,
Keamanan & Deployment) dan `backend-architecture-hr.md` §7 (checklist
"Terlihat Profesional"). Disusun setelah modul Employee/Auth (Phase 1),
Attendance (Phase 2), Leave (Phase 3), Payroll (Phase 4), dan Reports
(Phase 5) selesai diimplementasikan di backend.

> Status implementasi saat dokumen ini ditulis: **belum ada infrastruktur
> e2e test** (folder `test/`, `supertest`, `jest-e2e.json`) — baru unit test
> per service/calculator dengan mock repository. Dokumen ini adalah RENCANA
> untuk mengisi kekosongan itu, bukan laporan bahwa e2e test sudah berjalan.

---

## 1. Tujuan & Ruang Lingkup

Memverifikasi seluruh alur bisnis LINTAS MODUL (bukan lagi per-unit dengan
mock) berjalan benar di atas API + database Postgres sungguhan, sebelum
rilis ke pilot cabang (roadmap Phase 6: "Rilis bertahap: pilot 1 cabang →
rollout semua cabang").

**Termasuk cakupan:**
- E2E API test (HTTP request sungguhan ke NestJS + Postgres test database)
- Uji akurasi kalkulasi payroll dengan data seed nyata (bukan mock)
- Uji akurasi geofencing di berbagai kondisi
- Audit checklist keamanan & operasional (enkripsi, HTTPS, rate limiting,
  audit log, backup/DR)
- Rencana UAT & rilis bertahap

**Tidak termasuk (di luar cakupan dokumen ini):**
- Test otomasi mobile app (frontend-mobile-architecture-hr.md punya rencana
  test terpisah)
- Load/performance testing (belum ada target SLA yang didefinisikan di
  roadmap — perlu disepakati dulu sebelum disusun test plan-nya)

---

## 2. Prasyarat Lingkungan Test

### 2.1 Infrastruktur yang perlu ditambahkan

| Item | Status | Tindakan |
|---|---|---|
| `test/jest-e2e.json` + `test/app.e2e-spec.ts` | Belum ada | Buat sebelum E2E pertama dijalankan |
| Dependency `supertest` | Belum ada di `package.json` | `npm i -D supertest @types/supertest` |
| Database test terisolasi | Belum ada | Postgres terpisah dari dev/prod (docker-compose profile `test`), migration dijalankan bersih tiap run, `DROP SCHEMA public CASCADE` di `afterAll` |
| Seed data referensi wajib | **Belum ada** — `src/database/seeders/seed.ts` masih placeholder | Lihat §2.2 — tanpa ini payroll TIDAK BISA digenerate sama sekali |

### 2.2 Seed data yang WAJIB ada sebelum skenario E2E Payroll/Leave bisa jalan

Berikut tabel referensi yang kalkulator baca lewat repository (§5.5/§5.4),
dan **saat ini tidak ada satu pun baris data di dalamnya** karena `seed.ts`
belum diimplementasikan modul mana pun:

- `leave_types` — minimal "Cuti Tahunan", "Cuti Sakit", "Cuti Melahirkan",
  "Izin Pribadi (Unpaid)" sesuai istilah roadmap Phase 3
- `salary_components` — minimal "Gaji Pokok" (EARNING, fixed)
- `bpjs_settings` — JHT/JKK/JKM/JP/KESEHATAN, persentase resmi berlaku saat
  ini, dengan `effective_date`
- `tax_ptkp_settings` — TK0..TK3, K0..K3, `effective_year` tahun berjalan
- `tax_ter_rates` — kategori A/B/C, bracket penghasilan resmi PMK 168/2023,
  `effective_year` tahun berjalan
- Minimal 1 `company`, `branch` (dengan lat/lng/radius nyata untuk uji
  geofencing), `department`, `position`, `shift`

**Rekomendasi:** implementasikan `seed.ts` (masih placeholder) sebagai
prasyarat sebelum E2E test pertama ditulis — di luar cakupan tugas ini,
tapi dicatat di sini sebagai *blocker* nyata, bukan diam-diam diasumsikan
sudah ada.

---

## 3. Matriks Skenario E2E per Modul

Setiap baris = satu `it()` di `test/*.e2e-spec.ts`, dijalankan lewat HTTP
sungguhan (`supertest(app.getHttpServer())`), bukan panggil service
langsung — supaya guard, DTO validation, dan response format ikut teruji.

### 3.1 Auth & Employee (Phase 1)

| # | Skenario | Assertion kunci |
|---|---|---|
| A1 | Login HR_ADMIN valid → 200 + access/refresh token | `response.body.data.accessToken` ada |
| A2 | Login password salah → 401, format error `{success:false,errorCode,message}` | §4 format error |
| A3 | HR_ADMIN create employee baru → 201, `users`+`employees` konsisten (satu transaction) | Rollback jika salah satu gagal — insert email duplikat harus gagal total |
| A4 | EMPLOYEE coba create employee lain → 403 (RBAC) | `RolesGuard` |
| A5 | GET employee list tanpa memuat `passwordHash`/plaintext NIK di response | NIK di response harus SUDAH terdekripsi utuh (bukan ciphertext) — bukti `encryptedColumn` transform jalan dua arah |

### 3.2 Attendance / Geofencing (Phase 2)

| # | Skenario | Assertion kunci |
|---|---|---|
| B1 | Check-in dalam radius, sebelum toleransi shift → status `ON_TIME` | |
| B2 | Check-in dalam radius, lewat toleransi → status `LATE` | |
| B3 | Check-in di luar radius (mis. 500m dari titik cabang) → 403 `ATTENDANCE_OUT_OF_RADIUS`, TIDAK ada baris `attendances` tersimpan | Validasi jarak dihitung ULANG server-side, bukan trust client |
| B4 | Check-in dengan `deviceTimestamp` menyimpang >5 menit dari jam server → 400 `ATTENDANCE_CLOCK_MISMATCH` | |
| B5 | Check-in dua kali di hari yang sama → 409 Conflict | |
| B6 | Uji akurasi geofencing di titik BATAS radius (radius persis 100m, jarak 99m vs 101m) — verifikasi rumus Haversine tidak meleset karena floating point | roadmap Phase 6: "Uji akurasi geofencing di berbagai kondisi HP & sinyal GPS" — di E2E disimulasikan lewat variasi `latitude`/`longitude`/`accuracyMeters` pada request, BUKAN dengan HP fisik (itu bagian UAT §7) |
| B7 | `accuracyMeters` melebihi ambang (mis. 80m saat default 50m) → 400 `ATTENDANCE_LOW_GPS_ACCURACY` | |
| B8 | Pengajuan koreksi absensi oleh EMPLOYEE, approve oleh MANAGER (atasan langsung) → status `APPROVED`, baris `attendances` terbentuk/terupdate dalam satu transaction | |
| B9 | Approve koreksi oleh MANAGER yang BUKAN atasan langsung → 403 | |

### 3.3 Leave / Cuti (Phase 3)

| # | Skenario | Assertion kunci |
|---|---|---|
| C1 | Pengajuan Cuti Tahunan dengan saldo cukup → 201, `leave_approvals` level 1 (manager) & level 2 (HR) terbentuk sekaligus | Chain of Responsibility |
| C2 | Pengajuan dengan saldo tidak cukup → 400 `LEAVE_INSUFFICIENT_BALANCE` | |
| C3 | Manager approve level 1 → status tetap `PENDING`, `currentApprovalLevel` pindah ke 2, saldo BELUM terpotong | |
| C4 | HR approve level 2 (final) → status `APPROVED`, `leave_balances.usedDays` bertambah, **audit_logs** tercatat (`action=APPROVE_LEAVE_REQUEST`) | Checklist §7 audit log |
| C5 | Manager reject level 1 → status `REJECTED`, saldo TIDAK berubah | |
| C6 | **Integrasi lintas modul**: setelah C4 (approved), GET attendance history tanggal cuti → status `ON_LEAVE`, bukan `ABSENT`/kosong | Event `leave.approved` ditangkap `AttendanceService` |
| C7 | Cancel pengajuan APPROVED sebelum tanggal cuti → saldo dikembalikan, event `leave.cancelled` terpancar | |
| C8 | Karyawan lain coba approve (bukan approver assigned, bukan HR/Super Admin) → 403 | |

### 3.4 Payroll (Phase 4) — lihat detail matriks §4

| # | Skenario | Assertion kunci |
|---|---|---|
| D1 | `POST /payroll/generate` untuk periode baru → 201, `payroll_periods.status=GENERATED`, `payroll_items`+`payroll_item_details` terbentuk untuk setiap employee aktif | Satu transaction (§6) |
| D2 | Generate ULANG periode yang sama → 409, **tidak ada baris payroll_items baru** | Idempotency — constraint `UNIQUE(payroll_period_id, employee_id)` sebagai lapisan kedua |
| D3 | `GET /payroll/:id/detail` → breakdown lengkap per employee sesuai `payroll_item_details` | |
| D4 | `PUT /payroll/:id/approve` sebelum status `GENERATED` (masih `DRAFT`) → 409 | |
| D5 | `PUT /payroll/:id/approve` oleh FINANCE → 200, `audit_logs` tercatat (`action=APPROVE_PAYROLL`) DALAM transaction yang sama dengan update status | Checklist §7 |
| D6 | **Integrasi lintas modul**: employee dengan unpaid leave yang overlap periode → `payroll_items.total_deduction_unpaid` sesuai jumlah hari, terpotong dari basis BPJS/PPh21 | |
| D7 | **Integrasi lintas modul**: employee dengan jam kerja aktual > jadwal shift (dari data attendance) → `payroll_items.total_overtime` > 0, sesuai rumus Kepmenaker 102/2004 | |
| D8 | `GET /payroll/thr/:employeeId` masa kerja < 12 bulan → THR terprorata | |
| D9 | Role EMPLOYEE akses endpoint mana pun di `/payroll/*` → 403 | Data payroll sensitif |

### 3.5 Reports (Phase 5)

| # | Skenario | Assertion kunci |
|---|---|---|
| E1 | `GET /reports/attendance-summary` dengan filter `branchId` → hanya employee cabang tsb yang muncul | |
| E2 | `GET /reports/leave-summary` → `remainingDays` = `entitledDays + carriedOverDays - usedDays`, konsisten dengan `leave_balances` sungguhan | |
| E3 | `GET /reports/payroll-summary` untuk periode yang BELUM digenerate → 404 | |
| E4 | `GET /reports/payroll-summary` untuk periode yang sudah digenerate → total sama dengan SUM manual seluruh `payroll_items` periode tsb (query DB langsung sebagai pembanding) | |
| E5 | Role EMPLOYEE akses `/reports/*` → 403 | |

---

## 4. Matriks Kritis Payroll — Verifikasi Manual (roadmap Phase 6: wajib akurat)

Unit test (`*.calculator.spec.ts`, `payroll.service.spec.ts`) sudah
memverifikasi 3 skenario wajib dengan angka manual **memakai mock
repository**. Di tahap E2E, angka yang SAMA harus direproduksi lewat API
sungguhan dengan data ter-seed nyata (§2.2) — supaya migration, seed, dan
wiring DI (bukan cuma logika kalkulator) juga ikut terverifikasi.

| Skenario | Sumber angka pembanding | Cara verifikasi E2E |
|---|---|---|
| Karyawan tetap, gaji standar | Dihitung manual di luar sistem (spreadsheet) dari `bpjs_settings`/`tax_ter_rates` YANG SAMA dengan yang di-seed | `POST /payroll/generate` → bandingkan `payroll_items` vs spreadsheet, toleransi 0 (bukan pembulatan, karena `roundToRupiah` deterministik) |
| Karyawan dengan lembur | Rumus Kepmenaker 102/2004 dihitung manual dari data `attendances` seed | Idem, plus cek `payroll_item_details` ada baris "Lembur" |
| Karyawan dengan unpaid leave | Hari unpaid leave dari `leave_requests` seed (leaveType.isPaid=false) | Idem, plus cek `total_deduction_unpaid` |
| PPh21 TER — reklasifikasi kategori | Uji dengan karyawan TK0 (kategori A), K1 (kategori B), K3 (kategori C) | Bandingkan `terCategory`/`terRate` di `payroll_item_details` vs tabel PMK 168/2023 |
| BPJS — batas atas upah (`max_salary_base`) | Karyawan dengan gaji di atas & di bawah `max_salary_base` JP/Kesehatan | Basis iuran harus di-cap, bukan dihitung dari gaji penuh |

**Sign-off wajib:** hasil tabel di atas ditunjukkan ke tim HR/Finance
sungguhan untuk verifikasi manual (execution-guide-hr.md §7: "Setelah
Phase 4 backend selesai, sisihkan waktu khusus untuk verifikasi manual
angka lembur/BPJS/PPh21 dengan HR/finance sungguhan") — SEBELUM data
karyawan asli dipakai.

---

## 5. Keamanan (roadmap Phase 6)

| Item checklist | Status saat ini | Test/tindakan |
|---|---|---|
| Enkripsi data sensitif at-rest (NIK, NPWP, no. rekening) | ✅ Ada — `encryptedColumn` transformer (AES-256-GCM) di `Employee` entity | Test: query langsung ke Postgres (bypass ORM) untuk kolom `nik`/`npwp`/`bank_account_no` → harus berupa ciphertext, bukan plaintext |
| HTTPS | ⚠️ Tanggung jawab layer deployment (reverse proxy/load balancer), bukan kode aplikasi | Checklist deployment: pastikan TLS terpasang di depan NestJS sebelum rilis pilot; app sendiri tidak melakukan TLS termination |
| Rate limiting | ✅ `@nestjs/throttler` global (`APP_GUARD`) + batas lebih ketat di `POST /auth/login` (5/menit) dan `POST /attendance/check-in`/`check-out` (10/menit) | Test: kirim request melebihi limit → 429, `HealthController` (`@SkipThrottle()`) tetap bisa dipoll tanpa batas |
| Audit log | ✅ `APPROVE_PAYROLL`, `APPROVE/REJECT/CANCEL_LEAVE_REQUEST`, `APPROVE/REJECT_ATTENDANCE_CORRECTION` tercatat. Perubahan data karyawan (`EmployeeService.update`) & pembuatan `employee_salary_structures` (belum ada endpoint-nya) BELUM tercatat | Tambahkan audit log saat fitur CRUD salary structure dibangun |

---

## 6. Backup & Disaster Recovery (roadmap Phase 6)

Prioritas tertinggi: **data payroll** (roadmap: "Backup & disaster recovery
database, terutama data payroll").

- **Backup terjadwal**: `pg_dump` harian (retensi 30 hari) + WAL archiving
  untuk point-in-time recovery, khususnya sebelum & setelah setiap
  `POST /payroll/generate` (idempotency di level `payroll_periods.status`
  membantu, tapi tidak menggantikan backup).
- **Uji restore**: jadwalkan simulasi restore ke environment staging
  minimal 1x sebelum rilis pilot — restore yang tidak pernah diuji bukan
  backup yang bisa diandalkan.
- **RPO/RTO**: perlu disepakati dengan stakeholder bisnis (belum
  didefinisikan di roadmap) sebelum SLA backup difinalkan.

---

## 7. User Acceptance Testing (UAT)

Peserta: tim HR (approval cuti, generate payroll), Finance (approve
payroll, laporan), beberapa karyawan pilot (check-in/out, pengajuan cuti).

**Skrip UAT minimal:**
1. Karyawan pilot check-in dari lokasi kantor sungguhan (bukan simulasi) —
   verifikasi radius & GPS di kondisi HP nyata (roadmap: "berbagai kondisi
   HP & sinyal GPS" — bagian ini TIDAK bisa digantikan E2E API test, harus
   device fisik).
2. Karyawan pilot mengajukan Cuti Tahunan, atasan approve dari HP/browser.
3. HR generate payroll periode berjalan untuk 1 cabang pilot, Finance
   approve, HR/Finance cross-check angka manual (§4).
4. Sign-off tertulis dari HR & Finance sebelum lanjut ke rollout.

---

## 8. Rilis Bertahap

```
Pilot 1 cabang (2-4 minggu) -> evaluasi bug/feedback -> perbaikan
  -> rollout cabang berikutnya secara bertahap -> full rollout
```

Kriteria lanjut dari pilot ke rollout: nol bug kritikal terbuka di modul
Attendance/Payroll, sign-off UAT (§7) tertulis, backup/restore (§6) sudah
diuji sukses minimal sekali di environment yang sama dengan pilot.

---

## 9. Dokumentasi & Training (roadmap Phase 6)

- Manual pengguna: absen (check-in/out, koreksi), cuti (pengajuan,
  approval, pembatalan), payroll (lihat slip — menyusul bersama fitur PDF).
- Training admin HR: generate payroll, approve, baca laporan (`/reports/*`).
- **Belum ada README per modul** (checklist §7 backend-architecture-hr.md)
  — lihat temuan di laporan checklist terpisah; disarankan dibuat sebelum
  dokumentasi user final, supaya konsisten satu sumber.

---

## 10. Definition of Done — Phase 6

- [ ] Seed data referensi (§2.2) tersedia di environment staging
- [ ] Infrastruktur e2e test (`test/`, `supertest`) terpasang, seluruh
      skenario §3 lulus
- [ ] Matriks verifikasi manual payroll (§4) disetujui tertulis oleh
      HR/Finance
- [ ] Rate limiting sudah di kode (§5) — perlu diverifikasi lewat E2E test (skenario 429) sebelum endpoint publik dibuka
- [ ] Backup terjadwal aktif + minimal 1x uji restore sukses (§6)
- [ ] UAT (§7) sign-off tertulis
- [ ] Dokumentasi user & training admin HR (§9) selesai
