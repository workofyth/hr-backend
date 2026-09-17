# Panduan Eksekusi & Prompt Kit — Aplikasi HR

Dokumen ini adalah "lem" yang menyatukan 3 dokumen sebelumnya agar saat dieksekusi (oleh kamu, tim, atau AI coding assistant seperti Claude Code) hasilnya **konsisten** — penamaan, struktur, dan aturan bisnis tidak bertabrakan antar bagian.

**3 dokumen sumber (selalu jadi rujukan, jangan dieksekusi terpisah tanpa saling cek):**

1. `roadmap-aplikasi-hr.md` — fitur per fase (WHAT & WHY)
2. `backend-architecture-hr.md` — arsitektur backend + skema DB (HOW, server-side)
3. `frontend-mobile-architecture-hr.md` — arsitektur mobile app (HOW, client-side)

---

## 1. Prinsip Menjaga Keselarasan

Sebelum mulai eksekusi, tetapkan **4 sumber kebenaran (source of truth)** yang tidak boleh didefinisikan ulang di tempat lain:

1. **Skema database** → hanya ada di `backend-architecture-hr.md` §5. Kalau butuh field baru, update dokumen ini dulu, baru buat migration.
2. **Kontrak API** (format request/response) → didefinisikan sekali di backend, lalu frontend mengikuti — jangan sebaliknya.
3. **Nama fitur/istilah bisnis** → ikuti istilah di `roadmap-aplikasi-hr.md` (mis. selalu "Cuti Tahunan", jangan campur "Annual Leave" di satu tempat dan "Cuti Tahunan" di tempat lain).
4. **Urutan fase** → ikuti urutan Phase 0–6 di roadmap. Jangan mulai Phase 4 (Payroll) sebelum Phase 1–2 selesai, karena payroll butuh data absensi & karyawan yang sudah stabil.

**Aturan praktis:** setiap kali membuka sesi baru dengan AI assistant untuk mengerjakan satu bagian, **lampirkan/upload ketiga file .md ini** sebagai konteks, bukan hanya file yang relevan dengan fase itu saja — supaya AI tidak "lupa" pattern atau skema yang sudah ditetapkan.

---

## 2. Urutan Eksekusi yang Disarankan

```
Step 1: Setup repo & struktur folder (backend + mobile) — sekali di awal
Step 2: Backend Phase 1 (Core HRIS) → Frontend Auth & Profile
Step 3: Backend Phase 2 (Attendance/Geofencing) → Frontend Attendance
Step 4: Backend Phase 3 (Leave) → Frontend Leave
Step 5: Backend Phase 4 (Payroll) → Frontend Payroll (read-only view dulu)
Step 6: Backend Phase 5 (Reports) → Frontend Dashboard
Step 7: Testing & Deployment (Phase 6) — end-to-end, backend+frontend bersamaan
```

Backend selalu ± 1 fase di depan frontend, karena frontend butuh API sudah ada untuk diintegrasikan.

---

## 3. Master Prompt (pakai di AWAL setiap sesi baru)

Gunakan prompt ini setiap kali membuka sesi kerja baru (Claude Code, Cursor, dsb.) sebelum minta implementasi fitur apa pun. Ganti bagian `[...]` sesuai kebutuhan.

```
Kamu adalah software engineer yang membantu membangun aplikasi HR mandiri
(absensi radius/geofencing, pengajuan cuti, payroll sesuai UU Indonesia).

Aku sudah punya 3 dokumen acuan yang WAJIB kamu ikuti secara konsisten:
1. roadmap-aplikasi-hr.md          → fitur per fase
2. backend-architecture-hr.md      → arsitektur backend, design pattern, skema DB
3. frontend-mobile-architecture-hr.md → arsitektur mobile app, state management, pattern

Aturan kerja:
- Jangan mengubah/menyimpang dari skema database di backend-architecture-hr.md
  kecuali aku minta secara eksplisit. Kalau kamu merasa perlu field/tabel baru,
  usulkan dulu perubahan skemanya, baru lanjut coding.
- Ikuti pattern yang sudah ditentukan (Repository, Service Layer, Strategy,
  Factory, dst) — jangan pakai pendekatan lain meskipun itu valid secara umum.
- Ikuti struktur folder yang sudah didefinisikan di masing-masing dokumen.
- Gunakan istilah bisnis persis seperti di roadmap-aplikasi-hr.md
  (contoh: "Cuti Tahunan", bukan "Annual Leave").
- Setiap kali membuat kode baru, cek dulu checklist "Terlihat Profesional"
  di dokumen terkait sebelum menganggap task selesai.
- Untuk SEMUA layar/komponen UI, WAJIB ikuti Design System di
  frontend-mobile-architecture-hr.md §9 (font Satoshi + Inter/Plus Jakarta Sans,
  1 warna aksen, ikon Phosphor/Lucide, spacing skala 8/16/24/32, radius besar,
  shadow tipis, skeleton loading). Jangan membuat keputusan visual baru di luar
  token yang sudah ditentukan di sana.
- Kalau ada instruksi dariku yang bertentangan dengan dokumen, tanyakan dulu,
  jangan diam-diam menyimpang.

Sekarang aku mau kerjakan: [SEBUTKAN FASE/FITUR SPESIFIK DI SINI]
```

---

## 4. Prompt per Fase (Backend)

### Phase 0 — Setup Awal

```
Berdasarkan backend-architecture-hr.md §2 (struktur folder) dan §5 (skema DB),
buatkan:
1. Struktur folder project backend lengkap (folder kosong + file placeholder)
2. Setup awal ORM (sebutkan pilihan: Prisma/TypeORM) dengan koneksi ke PostgreSQL
3. File migration untuk tabel-tabel di §5.1 (Core/Organisasi) dan §5.2 (Karyawan & Auth)
4. Konfigurasi environment (.env.example) sesuai §4 dokumen (tidak ada hardcode credential)
Jangan buat logic bisnis dulu di step ini, fokus fondasi saja.
```

### Phase 1 — Core HRIS

```
Implementasikan modul Employee & Auth sesuai roadmap-aplikasi-hr.md Phase 1
dan backend-architecture-hr.md §3 (module employee, auth).

Yang harus ada:
- AuthController + AuthService (login, refresh token) — ikuti Repository Pattern
- EmployeeController + EmployeeService + EmployeeRepository (interface + implementasi)
- DTO dengan validasi untuk create/update employee
- RBAC guard sesuai role: SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE, FINANCE
- Unit test untuk EmployeeService (pakai mock repository)

Pastikan tidak ada logic bisnis di controller (cek checklist §7 backend-architecture-hr.md).
```

### Phase 2 — Attendance / Geofencing

```
Implementasikan modul Attendance sesuai roadmap-aplikasi-hr.md Phase 2
dan backend-architecture-hr.md §3 & §6 (alur check-in).

Yang harus ada:
- GeofenceValidationStrategy: hitung jarak Haversine, validasi radius SERVER-SIDE
  (jangan percaya perhitungan dari client)
- AttendanceService.checkIn() / checkOut() sesuai alur di §6
- Deteksi anomali dasar (timestamp device vs server terlalu jauh selisih)
- AttendanceCorrection flow (pengajuan koreksi + approval)
- Event emitter setelah check-in sukses (untuk notifikasi, sesuai pattern Observer)
- Unit test untuk GeofenceValidationStrategy dengan berbagai skenario jarak

Gunakan skema tabel attendances & attendance_corrections persis seperti §5.3.
```

### Phase 3 — Cuti & Izin

```
Implementasikan modul Leave sesuai roadmap-aplikasi-hr.md Phase 3
dan backend-architecture-hr.md §3 & §5.4.

Yang harus ada:
- LeaveService: pengajuan cuti, validasi saldo (leave_balances)
- Chain of Responsibility untuk approval berjenjang (manager -> HR),
  sesuai pattern di §3 backend-architecture-hr.md
- Auto-update leave_balances saat approve/reject/cancel
- Integrasi: saat cuti approved, tandai attendance di tanggal tsb sebagai 'ON_LEAVE'
  (bukan 'ABSENT') — cek ulang ke modul attendance
- Unit test untuk skenario saldo cuti tidak cukup, approval multi-level
```

### Phase 4 — Payroll & Kepatuhan

```
Implementasikan modul Payroll sesuai roadmap-aplikasi-hr.md Phase 4
dan backend-architecture-hr.md §3, §5.5, §6.

PENTING - ikuti persis:
- Setiap komponen hitung (overtime, BPJS, PPh21/TER, THR) adalah class Strategy
  terpisah, implementasikan interface yang jelas (ITaxCalculator, dst) —
  JANGAN gabung semua logika dalam satu fungsi besar
- PayrollCalculatorFactory memilih calculator sesuai employment_type
- Generate payroll HARUS dibungkus dalam satu database transaction (Unit of Work)
- Semua tarif (BPJS, PTKP, TER) diambil dari tabel bpjs_settings/tax_ptkp_settings/
  tax_ter_rates berdasarkan effective_date, JANGAN hardcode angka di kode
- Tambahkan constraint unique(payroll_period_id, employee_id) untuk idempotency
- Sertakan unit test dengan angka manual sebagai pembanding
  (siapkan minimal 3 skenario: karyawan tetap gaji standar, karyawan dengan
  lembur, karyawan dengan unpaid leave)

Setelah selesai, tunjukkan hasil perhitungan salah satu skenario secara detail
supaya bisa aku cek manual sebelum lanjut ke fitur berikutnya.
```

### Phase 5 & 6 — Reports, Testing, Deployment

```
Berdasarkan roadmap-aplikasi-hr.md Phase 5 & 6, buatkan:
1. Endpoint laporan (attendance summary, leave summary, payroll summary)
   dengan query yang memakai index sesuai §5.6 backend-architecture-hr.md
2. Susun test plan end-to-end mengikuti checklist §Phase 6 di roadmap
3. Review ulang seluruh checklist "Terlihat Profesional" (§7 backend-architecture-hr.md)
   pada modul yang sudah dibuat sejauh ini, laporkan bagian mana yang belum memenuhi
```

---

## 5. Prompt per Fase (Frontend/Mobile)

### Setup Awal

```
Berdasarkan frontend-mobile-architecture-hr.md §2, buatkan struktur folder
Flutter feature-first lengkap (core/, features/, app/) dengan file placeholder,
plus setup dependency injection (get_it/injectable) dan routing (go_router)
sesuai §5 dan §3 dokumen tsb.
```

### Setup Design System (jalankan sekali, sebelum bikin screen apa pun)

```
Berdasarkan frontend-mobile-architecture-hr.md §9 (Design System), buatkan
file-file token di core/theme/:
- colors.dart: definisikan token warna (colorPrimary, colorSurface,
  colorTextMuted, colorSuccess, colorDanger, dst) untuk light & dark mode,
  dengan 1 warna aksen saja (tanyakan ke aku warna aksennya apa jika belum
  ditentukan, contoh pilihan: navy tua / emerald / amber-gold)
- typography.dart: setup google_fonts untuk Satoshi (heading) dan
  Inter/Plus Jakarta Sans (body), dengan skala ukuran teks yang konsisten
- spacing.dart: konstanta AppSpacing (xs/sm/md/lg/xl) mengikuti skala 8/16/24/32
- app_theme.dart: gabungkan semua jadi ThemeData light & dark

Juga tambahkan dependency: google_fonts, flutter_animate, shimmer di pubspec.yaml.
Semua screen yang dibuat SETELAH ini wajib memakai token dari file-file ini,
tidak boleh hardcode warna/spacing/font langsung di widget.
```

### Auth & Profile (selaras Backend Phase 1)

```
Implementasikan fitur Auth & Profile sesuai frontend-mobile-architecture-hr.md
§2 dan §3 (BLoC pattern). Kontrak API HARUS mengikuti response format di
backend-architecture-hr.md §4 (format success/error).

Buat: LoginScreen, AuthBloc dengan state eksplisit (Initial/Loading/Success/Error),
LoginUseCase, AuthRepository (interface + impl), model→entity mapper.

Terapkan Design System §9 (token warna/font/spacing dari core/theme/),
tampilkan shimmer/skeleton saat loading, gunakan ikon dari Phosphor/Lucide.
```

### Attendance/Geofencing (selaras Backend Phase 2)

```
Implementasikan fitur Attendance sesuai frontend-mobile-architecture-hr.md
§5 (Modul Kritis: Geofencing di Client).

Wajib ada:
- LocationService (Facade) dengan getValidatedLocation():
  cek permission -> cek akurasi -> deteksi mock location -> return lat/lng
- CheckInUseCase yang memanggil LocationService lalu AttendanceRepository
- UI radius indicator real-time + tombol check-in disabled jika di luar radius
- Tegaskan di komentar kode: validasi client HANYA untuk UX,
  keputusan final tetap dari response backend
- (Opsional Phase lanjutan) queue offline untuk check-in saat tidak ada koneksi,
  sesuai Command Pattern di §4

Terapkan Design System §9: radius indicator pakai warna semantik dari token
(hijau untuk dalam radius, merah untuk di luar radius — tetap dalam 1 warna
aksen utama untuk elemen non-status), card dengan radius besar & shadow tipis,
ikon Phosphor/Lucide untuk status absensi.
```

### Leave (selaras Backend Phase 3)

```
Implementasikan fitur Cuti sesuai frontend-mobile-architecture-hr.md §7.
Buat: LeaveBalanceScreen, LeaveRequestFormScreen (validasi berbeda per jenis
cuti pakai Strategy pattern - contoh: cuti sakit wajib upload lampiran),
LeaveHistoryScreen, dan (untuk role Manager) ApprovalInboxScreen.
Istilah jenis cuti harus persis sama dengan leave_types di backend
(jangan buat daftar jenis cuti baru di frontend, ambil dari API).

Terapkan Design System §9: gunakan ilustrasi unDraw/Storyset untuk empty state
("Belum ada pengajuan cuti"), skeleton loading saat memuat saldo cuti,
token warna & spacing dari core/theme/.
```

### Payroll (selaras Backend Phase 4)

```
Implementasikan fitur Payroll (read-only untuk karyawan) sesuai
frontend-mobile-architecture-hr.md §7: PayslipHistoryScreen, PayslipDetailScreen
(breakdown earning/deduction sesuai payroll_item_details dari backend),
dan download PDF slip gaji.

Terapkan Design System §9: breakdown earning/deduction ditampilkan dengan
tipografi jelas (angka pakai font body, label pakai warna teks muted),
1 warna aksen untuk highlight net salary, radius besar pada card slip gaji.
```

---

## 6. Prompt "Audit Keselarasan" (jalankan berkala, misal tiap akhir fase)

Gunakan ini untuk mengecek apakah implementasi masih selaras dengan 3 dokumen, sebelum lanjut ke fase berikutnya:

```
Tolong audit kode yang sudah dibuat sejauh ini dibandingkan 3 dokumen acuan
(roadmap-aplikasi-hr.md, backend-architecture-hr.md, frontend-mobile-architecture-hr.md).

Cek dan laporkan:
1. Apakah skema database di kode (migration/entity) masih 100% sesuai §5
   backend-architecture-hr.md? Sebutkan jika ada penyimpangan.
2. Apakah design pattern yang dipakai konsisten dengan §3 kedua dokumen arsitektur?
3. Apakah ada istilah bisnis di kode/UI yang berbeda dari roadmap-aplikasi-hr.md?
4. Apakah checklist "Terlihat Profesional" di masing-masing dokumen sudah terpenuhi?
5. Apakah kontrak API antara backend dan frontend masih sinkron (nama field,
   format response)?

Sajikan hasil sebagai daftar: [OK] atau [PERLU DIPERBAIKI: alasan + rekomendasi].
```

---

## 7. Tips Praktis Tambahan

- **Satu fitur, satu sesi/PR.** Jangan minta AI mengerjakan backend+frontend+testing sekaligus dalam satu prompt panjang — hasilnya lebih mudah salah selaras. Ikuti urutan di §2.
- **Selalu minta AI menunjukkan hasil kalkulasi payroll secara eksplisit** (angka per komponen) sebelum kamu anggap fitur itu "selesai" — ini bagian paling riskan untuk salah.
- **Simpan 4 dokumen ini (termasuk file ini) sebagai project knowledge/context** yang selalu ikut di-attach, bukan cuma dibaca sekali di awal — supaya konsistensi terjaga sampai fase terakhir.
- **Update dokumen, bukan cuma kode**, kalau ada keputusan baru di tengah jalan (misal ganti ORM, tambah tabel). Dokumen yang basi lebih berbahaya daripada tidak ada dokumen sama sekali.
- Setelah Phase 4 (Payroll) backend selesai, sisihkan waktu khusus untuk **verifikasi manual** angka lembur/BPJS/PPh21 dengan HR/finance sungguhan sebelum dipakai ke gaji karyawan asli.
