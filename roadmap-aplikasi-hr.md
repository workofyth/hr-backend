# Roadmap Pengembangan Aplikasi HR Mandiri
### Absensi Berbasis Radius (Geofencing) • Manajemen Cuti • Payroll Sesuai Regulasi Indonesia

> Catatan: dokumen ini adalah panduan perencanaan produk & teknis. Untuk perhitungan payroll (PPh 21, BPJS, pesangon), tetap validasikan angka final dengan konsultan pajak/HR profesional sebelum dipakai produksi, karena aturan bisa berubah dan ada kasus-kasus khusus (PKWT/PKWTT, upah lembur shift, dll).

---

## 0. Gambaran Umum Sistem

**Modul utama:**
1. Core HRIS (data karyawan, role, struktur organisasi)
2. Absensi mobile berbasis radius/geofencing (+ opsional foto & face check)
3. Pengajuan Cuti & Izin (leave management, approval berjenjang)
4. Payroll otomatis (gaji, lembur, potongan, BPJS, PPh 21)
5. Laporan & Dashboard
6. Pengaturan perusahaan & kepatuhan (company settings & compliance)

**Rekomendasi Stack (bisa disesuaikan):**
- Mobile: Flutter atau React Native (butuh akses GPS, background location, kamera)
- Backend: Node.js (NestJS) / Laravel / Django REST — pilih yang timmu kuasai
- Database: PostgreSQL (relasional, kuat untuk payroll & audit trail)
- Auth: JWT + refresh token, opsional SSO
- Notifikasi: Firebase Cloud Messaging
- Storage file (slip gaji, foto absen): S3-compatible (MinIO/S3)
- Server waktu: gunakan UTC di DB, tampilkan WIB/WITA/WIT di UI

---

## Phase 0 — Perencanaan, Arsitektur & Setup (2–3 minggu)

### Tujuan
Menyiapkan fondasi teknis dan bisnis sebelum coding fitur.

### Fitur/Tugas
- [ ] Tentukan struktur organisasi: perusahaan → cabang/lokasi → departemen → jabatan
- [ ] Tentukan kebijakan HR dasar: jam kerja, hari libur, shift, jenis karyawan (tetap/kontrak/harian/lepas)
- [ ] Rancang skema database inti: `employees`, `companies`, `branches`, `departments`, `positions`, `shifts`
- [ ] Setup repo, CI/CD, environment (dev/staging/prod)
- [ ] Desain sistem role & permission (Admin HR, Manager/Approver, Karyawan, Finance/Payroll)
- [ ] Kebijakan keamanan data (enkripsi data sensitif: NIK, rekening bank, NPWP)
- [ ] Tentukan multi-tenant atau single-company (penting jika mau dijual ke banyak perusahaan nanti)

### Output
- ERD awal, dokumen kebijakan HR, environment siap pakai.

---

## Phase 1 — Autentikasi & Manajemen Karyawan (Core HRIS) (3–4 minggu)

### Tujuan
Data karyawan menjadi single source of truth untuk semua modul lain.

### Fitur
- [ ] Registrasi & login (email/HP + password, OTP opsional)
- [ ] Role-based access control (RBAC): Super Admin, HR Admin, Manager, Employee, Finance
- [ ] Manajemen data karyawan: data pribadi, kontrak (PKWT/PKWTT), tanggal masuk, status aktif/resign
- [ ] Manajemen jabatan, departemen, cabang/lokasi kerja
- [ ] Manajemen shift kerja (fixed/rotating) & kalender kerja (hari libur nasional & cuti bersama)
- [ ] Upload dokumen karyawan (KTP, NPWP, kontrak kerja, ijazah)
- [ ] Riwayat mutasi/promosi karyawan
- [ ] Employee self-service profile (karyawan bisa lihat & update data terbatas)

### Skema Data Kunci
- `users`, `employees`, `contracts`, `departments`, `positions`, `branches`, `shifts`, `holidays`

### API Kunci
- `POST /auth/login`, `POST /auth/refresh`
- `GET/POST/PUT /employees`
- `GET /branches`, `GET /shifts`

---

## Phase 2 — Absensi Berbasis Radius / Geofencing (4–5 minggu)

### Tujuan
Karyawan absen dari mobile hanya jika berada dalam radius lokasi kantor/cabang yang ditentukan.

### Fitur
- [ ] Setting titik lokasi kantor/cabang: latitude, longitude, radius (meter) — support multi-lokasi
- [ ] Absen masuk/pulang dengan validasi GPS (Haversine formula untuk hitung jarak user vs titik kantor)
- [ ] Deteksi mock location / fake GPS (anti-cheat dasar)
- [ ] Opsional: foto selfie saat absen, atau face verification
- [ ] Absen untuk karyawan WFH/dinas luar (dengan approval khusus / radius berbeda)
- [ ] Catat status: Tepat waktu, Terlambat, Pulang cepat, Alpha (tidak absen)
- [ ] Hitung otomatis jam kerja aktual vs jadwal shift
- [ ] Riwayat absensi personal (kalender bulanan)
- [ ] Dashboard admin: monitoring real-time siapa yang sudah/belum absen
- [ ] Pengajuan koreksi absensi (lupa absen, GPS error) dengan approval atasan
- [ ] Notifikasi push pengingat absen masuk/pulang
- [ ] Rekap kehadiran bulanan (hadir, telat, izin, alpha, lembur)

### Detail Teknis Radius
- Simpan `office_lat`, `office_lng`, `radius_meters` per cabang
- Hitung jarak real-time via formula Haversine di backend (jangan percaya perhitungan dari client saja — validasi ulang di server demi keamanan)
- Toleransi akurasi GPS (misal terima jika akurasi device < 50m)
- Log lokasi absen (lat/lng) untuk audit, bukan tracking terus-menerus (perhatikan privasi karyawan)

### Skema Data Kunci
- `office_locations`, `attendances`, `attendance_corrections`, `overtime_requests`

### API Kunci
- `POST /attendance/check-in`, `POST /attendance/check-out`
- `GET /attendance/history`
- `POST /attendance/correction-request`

---

## Phase 3 — Pengajuan Cuti & Izin (3–4 minggu)

### Tujuan
Digitalisasi seluruh alur cuti/izin sesuai kebijakan perusahaan & aturan ketenagakerjaan.

### Fitur
- [ ] Master jenis cuti/izin:
  - Cuti Tahunan (minimal 12 hari/tahun sesuai UU Ketenagakerjaan, berlaku setelah 12 bulan kerja)
  - Cuti Sakit (dengan/tanpa surat dokter)
  - Cuti Melahirkan (1,5 bulan sebelum & 1,5 bulan setelah persalinan)
  - Cuti Menikah, Cuti Duka (keluarga inti meninggal), Cuti Khitanan/Baptis anak — sesuai UU Ketenagakerjaan
  - Izin pribadi (unpaid/paid sesuai kebijakan perusahaan)
  - Cuti besar/panjang (jika perusahaan menerapkan)
- [ ] Saldo cuti otomatis (accrual bulanan/tahunan), termasuk carry-over sesuai kebijakan
- [ ] Form pengajuan cuti dengan lampiran (surat dokter, dll)
- [ ] Alur approval berjenjang (atasan langsung → HR, bisa multi-level)
- [ ] Notifikasi status pengajuan (pending/approved/rejected) ke karyawan & approver
- [ ] Kalender tim: lihat siapa yang cuti agar tidak bentrok
- [ ] Pembatalan/revisi pengajuan cuti
- [ ] Riwayat & laporan penggunaan cuti per karyawan/departemen
- [ ] Integrasi otomatis ke absensi (hari cuti tidak dihitung alpha) dan ke payroll (potongan jika unpaid leave)

### Skema Data Kunci
- `leave_types`, `leave_balances`, `leave_requests`, `leave_approvals`

### API Kunci
- `GET /leave-types`, `GET /leave-balance`
- `POST /leave-requests`, `PUT /leave-requests/:id/approve`

---

## Phase 4 — Payroll & Kepatuhan Regulasi (5–7 minggu)

### Tujuan
Menghitung gaji otomatis, akurat, dan sesuai peraturan perundang-undangan Indonesia.

### Referensi Regulasi Utama (perlu terus dipantau perubahannya)
- UU No. 13/2003 jo. UU No. 6/2023 (Cipta Kerja) — ketenagakerjaan, pesangon, jam kerja & lembur
- PP No. 35/2021 — PKWT, alih daya, waktu kerja, PHK & kompensasi
- PP No. 36/2021 — Pengupahan (UMP/UMK, struktur skala upah, lembur)
- Kepmenaker No. 102/2004 & aturan turunannya — perhitungan lembur
- Aturan BPJS Ketenagakerjaan (JHT, JKK, JKM, JP) & BPJS Kesehatan — persentase iuran & pembagian perusahaan/karyawan
- PMK terbaru soal PPh 21 dengan skema TER (Tarif Efektif Rata-rata) — berlaku sejak 2024

### Fitur
- [ ] Master komponen gaji: gaji pokok, tunjangan tetap/tidak tetap, transport, makan, jabatan
- [ ] Setting struktur & skala upah per jabatan (wajib bagi perusahaan sesuai PP 36/2021)
- [ ] Perhitungan otomatis:
  - [ ] Gaji pro-rata (karyawan baru/resign di tengah bulan)
  - [ ] Lembur sesuai rumus resmi (1/173 x upah sebulan, dikali faktor lembur hari kerja/libur)
  - [ ] Potongan tidak hadir/alpha & unpaid leave
  - [ ] Potongan keterlambatan (jika ada kebijakan)
- [ ] Perhitungan BPJS Ketenagakerjaan (JHT, JKK, JKM, JP) — otomatis split porsi perusahaan & karyawan
- [ ] Perhitungan BPJS Kesehatan (persentase & batas upah pelaporan)
- [ ] Perhitungan PPh 21 dengan metode TER bulanan + rekonsiliasi tahunan (TER tahunan/Desember)
- [ ] Manajemen PTKP (status pernikahan, jumlah tanggungan) per karyawan
- [ ] Perhitungan THR (Tunjangan Hari Raya) otomatis sesuai masa kerja
- [ ] Perhitungan pesangon/uang penghargaan masa kerja/uang penggantian hak saat PHK (sesuai PP 35/2021)
- [ ] Slip gaji digital (PDF) dengan rincian lengkap (bruto, potongan, netto)
- [ ] Approval payroll berjenjang sebelum "lock" & pembayaran
- [ ] Export data untuk transfer bank (format CSV/Excel sesuai bank)
- [ ] Laporan wajib: rekap PPh 21 (untuk e-Bupot/SPT), rekap iuran BPJS
- [ ] Riwayat & arsip slip gaji per periode
- [ ] Karyawan bisa unduh slip gaji sendiri dari app

### Skema Data Kunci
- `salary_components`, `salary_structures`, `payroll_periods`, `payroll_items`, `tax_settings (PTKP/TER)`, `bpjs_settings`, `payslips`

### API Kunci
- `POST /payroll/generate` (per periode)
- `GET /payroll/:id/detail`
- `POST /payroll/:id/approve`
- `GET /payslips/:employeeId`

### Catatan Penting
- Simpan histori tarif (UMP/UMK, persentase BPJS, tabel TER) per periode berlaku — jangan hardcode, karena aturan berubah tiap tahun.
- Sediakan audit trail: siapa mengubah komponen gaji, kapan, dan alasan apa.

---

## Phase 5 — Laporan, Dashboard & Analitik (2–3 minggu)

### Fitur
- [ ] Dashboard HR: headcount, turnover, absensi harian, cuti aktif
- [ ] Dashboard Finance: total biaya gaji per bulan, biaya BPJS, biaya lembur
- [ ] Laporan absensi per karyawan/departemen/cabang (export Excel/PDF)
- [ ] Laporan cuti (saldo, penggunaan, sisa cuti)
- [ ] Laporan payroll (rekap gaji, PPh 21, BPJS) siap lapor ke instansi terkait
- [ ] Grafik tren (kehadiran, keterlambatan, turnover)

---

## Phase 6 — Testing, Keamanan & Deployment (3–4 minggu)

### Fitur/Tugas
- [ ] Unit test & integration test untuk logika payroll (paling kritikal, wajib akurat)
- [ ] Uji perhitungan lembur, PPh 21, BPJS dengan kasus nyata/manual sebagai pembanding
- [ ] Uji akurasi geofencing di berbagai kondisi HP & sinyal GPS
- [ ] Keamanan: enkripsi data sensitif at-rest, HTTPS, rate limiting, audit log
- [ ] Backup & disaster recovery database (terutama data payroll)
- [ ] User Acceptance Testing (UAT) bersama tim HR & beberapa karyawan pilot
- [ ] Rilis bertahap: pilot 1 cabang → rollout semua cabang
- [ ] Dokumentasi user (manual absen, cuti, payroll) & training admin HR

---

## Ringkasan Estimasi Waktu (Tim kecil, 3–5 orang)

| Phase | Estimasi |
|---|---|
| 0. Perencanaan & Arsitektur | 2–3 minggu |
| 1. Core HRIS | 3–4 minggu |
| 2. Absensi Radius | 4–5 minggu |
| 3. Cuti & Izin | 3–4 minggu |
| 4. Payroll & Kepatuhan | 5–7 minggu |
| 5. Laporan & Dashboard | 2–3 minggu |
| 6. Testing & Deployment | 3–4 minggu |
| **Total** | **± 22–30 minggu (5–7 bulan)** |

---

## Prioritas Jika Ingin MVP Cepat
Jika ingin rilis versi awal (MVP) lebih cepat, urutan prioritas yang disarankan:
1. Phase 1 (data karyawan minimal) 
2. Phase 2 (absensi radius — fitur pembeda utama)
3. Phase 3 (cuti — sering dipakai harian)
4. Phase 4 versi sederhana (gaji pokok + potongan alpha + BPJS + PPh21 dasar, tanpa fitur PHK/pesangon dulu)
5. Baru lengkapi Phase 4 penuh & Phase 5 setelah ada feedback pengguna nyata
