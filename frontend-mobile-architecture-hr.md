# Frontend / Mobile App Architecture — Aplikasi HR

Dokumen pendamping dari `roadmap-aplikasi-hr.md` dan `backend-architecture-hr.md`. Fokus: struktur mobile app, state management, penanganan GPS/geofencing di client, serta pola desain agar kode frontend rapi dan scalable.

> Rekomendasi stack: **Flutter** (satu codebase Android+iOS, akses native GPS/kamera matang). Alternatif: React Native. Contoh struktur di bawah pakai Flutter, tapi konsepnya portable ke RN (folder/pattern setara ada catatannya).

---

## 1. Prinsip Arsitektur Frontend

Gunakan **Clean Architecture ala mobile** dengan 3 lapisan:

```
Presentation Layer  → UI (Widget/Screen) + State Management (Bloc/Cubit/Riverpod)
Domain Layer        → Use Case (logika bisnis di sisi client, murni Dart/JS, tidak tahu UI/HTTP)
Data Layer          → Repository + Data Source (Remote API, Local Cache/DB)
```

**Aturan wajib:**
- Widget/Screen **tidak boleh** memanggil API langsung. Screen hanya bicara dengan state management (Bloc/Cubit/Provider), yang lalu memanggil Use Case.
- Use Case **tidak boleh** tahu detail UI (tidak import widget). Murni fungsi bisnis: `CheckInUseCase`, `SubmitLeaveRequestUseCase`.
- Repository menyembunyikan sumber data (API vs cache lokal) dari layer atas — Use Case tidak peduli datanya dari mana.
- Semua model API (JSON) dipisahkan dari model domain (Entity) via mapper, supaya perubahan struktur response backend tidak merusak seluruh UI.

---

## 2. Struktur Folder (Flutter, feature-first)

```
lib/
├── core/
│   ├── network/               # dio client, interceptor (auth token, retry, logging)
│   ├── storage/                # secure storage (token), local db (drift/hive) untuk cache/offline
│   ├── location/               # geofence_service.dart, mock_location_detector.dart
│   ├── error/                  # failure.dart, exception.dart, error_mapper.dart
│   ├── utils/                  # date_util.dart, currency_formatter.dart, validators.dart
│   ├── theme/                  # colors.dart, typography.dart, app_theme.dart
│   └── widgets/                # shared widgets: PrimaryButton, AppTextField, LoadingOverlay
│
├── features/
│   ├── auth/
│   │   ├── data/
│   │   │   ├── datasources/auth_remote_datasource.dart
│   │   │   ├── models/login_response_model.dart
│   │   │   └── repositories/auth_repository_impl.dart
│   │   ├── domain/
│   │   │   ├── entities/user_entity.dart
│   │   │   ├── repositories/auth_repository.dart      # abstract/interface
│   │   │   └── usecases/login_usecase.dart
│   │   └── presentation/
│   │       ├── bloc/auth_bloc.dart
│   │       ├── screens/login_screen.dart
│   │       └── widgets/
│   │
│   ├── attendance/
│   │   ├── data/
│   │   ├── domain/
│   │   │   └── usecases/
│   │   │       ├── check_in_usecase.dart
│   │   │       ├── check_out_usecase.dart
│   │   │       └── get_attendance_history_usecase.dart
│   │   └── presentation/
│   │       ├── bloc/attendance_bloc.dart
│   │       ├── screens/attendance_home_screen.dart
│   │       ├── screens/attendance_history_screen.dart
│   │       └── widgets/radius_status_badge.dart
│   │
│   ├── leave/
│   │   ├── data/ | domain/ | presentation/
│   │   └── ... (leave_request_usecase.dart, leave_balance_usecase.dart)
│   │
│   ├── payroll/
│   │   ├── data/ | domain/ | presentation/
│   │   └── ... (get_payslip_usecase.dart, download_payslip_usecase.dart)
│   │
│   └── profile/
│
├── app/
│   ├── router/                 # go_router config, route guard by role
│   └── app.dart                # root widget, theme, localization
│
└── main.dart
```

**Padanan di React Native:** `core/` → `src/core`, `features/xxx/data|domain|presentation` tetap sama, Bloc/Cubit diganti Redux Toolkit / Zustand / Riverpod-equivalent, `dio` diganti `axios`.

---

## 3. State Management

**Rekomendasi:** BLoC/Cubit (Flutter) atau Redux Toolkit/Zustand (React Native) — pilih **satu** dan konsisten di seluruh app, jangan campur beberapa pendekatan state management dalam satu proyek.

**Pola per screen:**
```
Event/Action → Bloc/Cubit menerima → panggil UseCase → UseCase panggil Repository
→ Repository return Either<Failure, Data> → Bloc emit State (Loading/Success/Error)
→ Screen listen ke State, render UI sesuai kondisi
```

**State standar tiap fitur (gunakan sealed class/union type):**
```dart
sealed class AttendanceState {}
class AttendanceInitial extends AttendanceState {}
class AttendanceLoading extends AttendanceState {}
class AttendanceCheckedIn extends AttendanceState { final Attendance data; }
class AttendanceOutOfRadius extends AttendanceState { final double distanceMeters; }
class AttendanceError extends AttendanceState { final String message; }
```
Dengan begini UI tidak pernah menebak-nebak kondisi lewat null check berantai — setiap state eksplisit dan exhaustive (compiler akan warning kalau ada state yang belum di-handle).

---

## 4. Design Pattern di Frontend

| Pattern | Dipakai di | Kenapa |
|---|---|---|
| **BLoC Pattern (Observer variant)** | Semua fitur | Pemisahan UI dan logika state, mudah di-test tanpa render widget. |
| **Repository Pattern** | Data layer semua fitur | Screen/UseCase tidak peduli data dari API atau cache lokal (penting untuk mode offline absensi). |
| **Adapter/Mapper Pattern** | `models/*.dart` → `entities/*.dart` | Isolasi perubahan struktur JSON backend dari domain layer & UI. |
| **Strategy Pattern** | Validasi form per jenis cuti (cuti sakit wajib lampiran, cuti tahunan tidak), format currency per locale | Aturan berbeda per kasus tanpa `if-else` menumpuk di widget. |
| **Factory Pattern** | Pembuatan widget kartu status absensi (`AttendanceCardFactory` → beda tampilan untuk ON_TIME/LATE/ABSENT) | Konsisten & mudah tambah status baru. |
| **Singleton (via DI: get_it/injectable atau Riverpod Provider)** | `ApiClient`, `SecureStorage`, `GeofenceService` | Satu instance dipakai di seluruh app, gampang di-mock saat test. |
| **Facade Pattern** | `LocationService` membungkus kompleksitas permission + GPS stream + mock-location check jadi satu API sederhana `getValidatedLocation()` | Screen/Bloc tidak perlu tahu detail permission handling atau deteksi fake GPS. |
| **Command Pattern** | Retry queue untuk absen saat offline (simpan "perintah check-in" lalu dieksekusi ulang saat online) | Mendukung mode offline-first untuk absensi di lokasi dengan sinyal lemah. |

---

## 5. Modul Kritis: Geofencing di Client

### Alur `getValidatedLocation()` (Facade)
1. Cek permission lokasi (`whileInUse` minimal; `always` jika butuh reminder background)
2. Cek apakah GPS aktif & akurasi memadai (tolak jika akurasi > 50m, minta user pindah ke area terbuka)
3. **Deteksi mock location** (Android: `Location.isFromMockProvider()`; kombinasikan dengan deteksi root/jailbreak dasar) — jika terdeteksi, tolak dengan pesan jelas, catat percobaan ke log
4. Ambil `lat, lng` + `accuracy`
5. Hitung jarak ke titik kantor (Haversine) — **hanya untuk feedback UI instan**; validasi final tetap dilakukan ulang di backend (jangan pernah percaya perhitungan client sebagai keputusan akhir)
6. Kirim `lat, lng, accuracy, deviceTimestamp` ke backend saat check-in

### Contoh kontrak use case
```dart
class CheckInUseCase {
  final AttendanceRepository repository;
  final LocationService locationService;

  Future<Either<Failure, Attendance>> call() async {
    final locationResult = await locationService.getValidatedLocation();
    return locationResult.fold(
      (failure) => Left(failure),
      (location) => repository.checkIn(location),
    );
  }
}
```

### UI/UX terkait
- Tampilkan **radius indicator** real-time (mis. "Anda 45m dari kantor — bisa absen" / "Anda 320m dari kantor — di luar radius")
- Tombol Check-in disabled otomatis jika di luar radius, dengan tombol alternatif "Ajukan Absen Manual" (masuk ke `attendance_corrections`)
- State loading jelas saat GPS masih mencari sinyal ("Mencari lokasi...")
- Mode WFH/dinas luar: skip validasi radius tapi wajib isi catatan + opsional approval sebelumnya

---

## 6. Modul Offline-First (opsional tapi disarankan)

Untuk lokasi kerja dengan sinyal internet tidak stabil:
- Simpan hasil check-in ke local DB (`drift`/`hive`/`sqflite`) dulu dengan status `PENDING_SYNC`
- Background job/queue mencoba kirim ke server saat koneksi tersedia (Command Pattern)
- Tampilkan badge "Menunggu sinkronisasi" di UI riwayat absensi
- Backend tetap validasi ulang timestamp & lokasi saat sync masuk (cegah manipulasi jam device)

---

## 7. Struktur UI per Fitur (Ringkasan Layar)

| Fitur | Layar Utama |
|---|---|
| Auth | Login, Lupa Password, OTP Verification |
| Absensi | Home (tombol check-in/out + radius indicator), Riwayat Absensi (kalender), Form Koreksi Absensi, Form Lembur |
| Cuti | Saldo Cuti, Form Pengajuan Cuti, Riwayat Pengajuan, Approval Inbox (untuk Manager), Kalender Tim |
| Payroll | Riwayat Slip Gaji, Detail Slip Gaji (breakdown), Download PDF |
| Profil | Data Diri, Dokumen, Ubah Password, Pengaturan Notifikasi |
| Admin (jika role Manager/HR di app yang sama) | Dashboard Approval, Monitoring Kehadiran Tim |

---

## 8. Konvensi Kode Frontend

- **Naming:** file `snake_case.dart`, class `PascalCase`, variabel/fungsi `camelCase`, konstanta `kCamelCase` atau `UPPER_SNAKE_CASE` sesuai konvensi tim.
- **Tidak ada logic bisnis di widget** — widget hanya render berdasarkan state, semua kalkulasi/keputusan ada di Bloc/UseCase.
- **Const constructor** untuk widget statis (`const Text(...)`) demi performa rebuild.
- **Reusable component library** di `core/widgets` — semua button, input, card pakai komponen shared, bukan styling manual berulang di tiap screen (agar konsisten & gampang ganti tema/branding).
- **Localization** siap sejak awal (`intl`/`easy_localization`) meski awalnya cuma Bahasa Indonesia — memudahkan ekspansi.
- **Environment terpisah** (dev/staging/prod) via `--dart-define` atau file `.env`, base URL API tidak pernah hardcode.
- **Error handling seragam**: semua Repository return `Either<Failure, T>` (pakai package `dartz`/`fpdart`), UI selalu tahu cara menampilkan error tanpa try-catch bertebaran di widget.
- **Testing:** widget test untuk komponen kritis (radius indicator, form validasi cuti), unit test untuk semua UseCase dengan mock repository.

---

## 9. Design System — UI/UX Gratis Tapi Terlihat Mewah

Diterapkan ke **semua fitur/layar** (bukan opsional per fitur). Simpan token ini di `core/theme/` (`colors.dart`, `typography.dart`, `spacing.dart`) sehingga seluruh screen memakai sumber yang sama, bukan styling manual berulang.

### Tipografi (gratis)
- Heading/Judul: **Satoshi** (Fontshare, gratis) — bold, sedikit tegas, kesan modern
- Body/teks umum: **Inter** atau **Plus Jakarta Sans** (Google Fonts) — bersih, mudah dibaca di layar kecil
- Maksimal 2 font dalam satu app. Gunakan bobot (weight) berbeda untuk hierarki, bukan font ketiga.
- Implementasi Flutter: pakai package `google_fonts` agar tidak perlu bundling manual.

### Warna
- Palet netral dominan (putih/abu sangat muda untuk light mode, abu gelap pekat untuk dark mode) + **1 warna aksen saja** (contoh: navy tua, emerald, atau amber/gold).
- Dark mode dengan aksen gold/amber cocok untuk kesan premium khas produk fintech/HR.
- Definisikan sebagai token semantik, bukan hex langsung di widget: `colorPrimary`, `colorSurface`, `colorTextMuted`, `colorSuccess`, `colorDanger`, dst.
- Jangan lebih dari 1 warna aksen aktif dalam satu layar.

### Ikon & Ilustrasi (gratis)
- Ikon: **Phosphor Icons** atau **Lucide Icons** (versi outline/thin) — lebih elegan dari ikon default Material.
- Ilustrasi empty state (misal "Belum ada pengajuan cuti", "Belum absen hari ini"): **unDraw** atau **Storyset**, warnanya disesuaikan ke warna aksen tema.

### Layout & Komponen
- Spacing pakai skala tetap: `8 / 16 / 24 / 32` px — tidak ada angka spacing acak lain.
- `border-radius` besar untuk card (16–20px), shadow sangat tipis (bukan shadow tebal/flat kotak tajam).
- Whitespace antar elemen dibuat lebih lega dari insting biasa — ini yang paling membedakan tampilan "murah" vs "premium", gratis tanpa aset tambahan.
- Skeleton loading (package `shimmer`) menggantikan spinner polos saat data sedang dimuat.
- Transisi halus antar state/screen (package `flutter_animate`) — fade/slide ringan, jangan berlebihan.

### Referensi Cepat (gratis, untuk dicontek langsung)
- Figma Community: cari "HR Dashboard UI Kit" atau "Attendance App UI Kit"
- **Untitled UI** (versi community/free) untuk pola komponen dashboard SaaS

### Aturan Konsistensi (tambahan untuk §8 Konvensi Kode)
- [ ] Semua warna diambil dari token tema (`AppColors.*`), tidak ada `Color(0xFF...)` hardcode di widget
- [ ] Semua spacing pakai konstanta (`AppSpacing.md`, dst), tidak ada `SizedBox(height: 13)` acak
- [ ] Semua ikon dari satu family (Phosphor/Lucide), tidak dicampur dengan ikon default framework
- [ ] Setiap screen baru dicek: apakah whitespace, radius, dan tipografinya konsisten dengan screen lain sebelum dianggap selesai

---

## 10. Checklist "Terlihat Profesional" (Frontend Review)

- [ ] Tidak ada pemanggilan API langsung dari widget/screen
- [ ] Semua state eksplisit (loading/success/error/empty), tidak ada UI yang blank tanpa feedback
- [ ] Validasi lokasi client hanya untuk UX, keputusan final tetap divalidasi backend
- [ ] Tidak ada base URL/API key hardcode di source code
- [ ] Semua teks yang tampil ke user lewat file localization, bukan string literal tersebar
- [ ] Komponen UI reusable dipakai konsisten (tidak ada duplikasi styling manual)
- [ ] Ada penanganan mode offline minimal untuk fitur absensi
- [ ] Unit test untuk seluruh use case bisnis penting (check-in, submit cuti)
- [ ] Sensitive data (token) disimpan di secure storage, bukan `SharedPreferences` biasa
