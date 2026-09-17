# Backend Architecture & Database Schema — Aplikasi HR

Dokumen pendamping dari `roadmap-aplikasi-hr.md`. Fokus dokumen ini: struktur backend, skema database lengkap, dan aturan design pattern/coding standard agar codebase konsisten, scalable, dan mudah di-maintain oleh tim (atau AI assistant) siapa pun yang mengerjakannya.

---

## 1. Prinsip Arsitektur

Gunakan **Layered Architecture** (mirip Clean Architecture / Hexagonal), dengan pemisahan tanggung jawab yang tegas:

```
Presentation Layer   → Controller / Route Handler (terima request, validasi input, kirim response)
Application Layer    → Service / Use Case (logika bisnis)
Domain Layer         → Entity, Value Object, Domain Rules
Infrastructure Layer → Repository (akses DB), External API client (BPJS/pajak/notifikasi)
```

**Aturan wajib:**
- Controller **tidak boleh** langsung query ke database. Controller hanya memanggil Service.
- Service **tidak boleh** tahu detail HTTP (request/response object). Service hanya menerima/mengembalikan DTO atau entity murni.
- Repository **hanya** bertanggung jawab untuk akses data (CRUD, query). Tidak ada logika bisnis di sini.
- Semua logika bisnis kritikal (perhitungan payroll, validasi radius, saldo cuti) harus 100% berada di Service/Domain layer agar bisa di-unit-test tanpa perlu HTTP server atau database asli (pakai mock repository).

---

## 2. Struktur Folder (contoh Node.js/NestJS, adaptasi bebas ke stack lain)

```
src/
├── common/                     # shared utilities, decorators, guards, filters
│   ├── decorators/
│   ├── filters/                # exception filters (format error konsisten)
│   ├── guards/                 # auth guard, role guard
│   ├── interceptors/           # logging, response transformer
│   └── utils/                  # haversine.util.ts, date.util.ts, currency.util.ts
│
├── config/                     # konfigurasi env, database, jwt, dsb
│
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   └── strategies/         # jwt.strategy.ts, local.strategy.ts
│   │
│   ├── employee/
│   │   ├── employee.controller.ts
│   │   ├── employee.service.ts
│   │   ├── employee.repository.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── organization/            # read-only: companies/branches/departments/
│   │   ├── organization.controller.ts   # positions — data referensi §5.1,
│   │   └── organization.service.ts      # dipakai dropdown Admin Dashboard.
│   │                                     # Tidak ada create/update/delete di
│   │                                     # sini — perubahan data organisasi
│   │                                     # masih lewat migration/SQL manual
│   │                                     # sampai ada kebutuhan CRUD penuh.
│   │
│   ├── attendance/
│   │   ├── attendance.controller.ts
│   │   ├── attendance.service.ts
│   │   ├── attendance.repository.ts
│   │   ├── strategies/          # geofence-validation.strategy.ts
│   │   └── dto/
│   │
│   ├── leave/
│   │   ├── leave.controller.ts
│   │   ├── leave.service.ts
│   │   ├── leave.repository.ts
│   │   ├── approval/            # chain-of-responsibility untuk approval berjenjang
│   │   └── dto/
│   │
│   ├── payroll/
│   │   ├── payroll.controller.ts
│   │   ├── payroll.service.ts
│   │   ├── payroll.repository.ts
│   │   ├── calculators/          # strategy pattern per komponen hitung
│   │   │   ├── overtime.calculator.ts
│   │   │   ├── bpjs.calculator.ts
│   │   │   ├── pph21.calculator.ts
│   │   │   └── thr.calculator.ts
│   │   └── dto/
│   │
│   └── notification/
│       ├── notification.service.ts
│       └── channels/             # push.channel.ts, email.channel.ts (strategy)
│
├── database/
│   ├── migrations/
│   ├── seeders/
│   └── entities/                 # jika pakai ORM terpisah dari modul
│
└── main.ts

public/
└── admin/                        # Admin Dashboard statis (HTML/CSS/JS vanilla,
                                   # tanpa build tooling). Murni consumer REST
                                   # API yang sama dengan mobile app — TIDAK
                                   # ada logika bisnis/akses DB di sini. Di-serve
                                   # oleh backend di path /admin lewat
                                   # @nestjs/serve-static, terpisah dari prefix
                                   # /api/v1. Bukan pengganti aplikasi mobile
                                   # (frontend-mobile-architecture-hr.md) —
                                   # cuma alat bantu HR Admin/Super Admin untuk
                                   # kelola data dasar dari browser.
```

**Dokumentasi API interaktif (Swagger/OpenAPI):** di-generate otomatis dari
DTO + decorator controller (`@nestjs/swagger`, plugin CLI diaktifkan lewat
`nest-cli.json` supaya minim boilerplate), tersedia di `/api/docs` saat
aplikasi jalan. Bukan tabel/skema baru — murni lapisan dokumentasi di atas
kode yang sudah ada.

---

## 3. Design Pattern yang Dipakai & Alasannya

| Pattern | Dipakai di | Kenapa |
|---|---|---|
| **Repository Pattern** | Semua modul akses data | Memisahkan logika bisnis dari detail ORM/SQL. Memudahkan ganti database atau unit test pakai mock repository. |
| **Service Layer / Use Case** | Semua modul | Satu tempat untuk logika bisnis, dipanggil dari controller maupun job scheduler/cron. |
| **DTO (Data Transfer Object) + Validation** | Semua request/response | Validasi input konsisten (pakai `class-validator` / `zod`), controller tidak menerima data mentah tanpa bentuk. |
| **Strategy Pattern** | Perhitungan payroll (`overtime.calculator.ts`, `pph21.calculator.ts`), validasi geofence, channel notifikasi | Aturan (lembur, pajak, radius) sering berubah tiap tahun/kebijakan. Dengan strategy, ganti aturan = ganti/tambah class, tanpa ubah kode inti. |
| **Factory Pattern** | Pembuatan calculator payroll sesuai jenis karyawan (tetap/kontrak/harian) | Logika pemilihan strategi terpusat, controller/service tidak perlu tahu detail `if-else` jenis karyawan. |
| **Chain of Responsibility** | Alur approval cuti berjenjang (atasan → HR → Direktur jika perlu) | Setiap level approval adalah handler independen, mudah menambah/mengurangi level approval tanpa mengubah logika inti. |
| **Observer / Event-driven** | Setelah absensi tercatat → trigger notifikasi; setelah cuti disetujui → update saldo & kalender tim; setelah payroll di-generate → kirim slip gaji | Decoupling antar modul. Gunakan event emitter internal (`EventEmitter2` di NestJS) atau message queue (BullMQ/RabbitMQ) untuk proses async/berat (generate PDF, kirim notifikasi massal). |
| **Unit of Work / Transaction Wrapper** | Payroll generation, approval cuti yang mengubah banyak tabel sekaligus | Pastikan operasi multi-tabel bersifat atomic (semua sukses atau semua rollback) — krusial di payroll agar data tidak setengah-jalan. |
| **Decorator Pattern** | Guard/middleware auth & role (`@Roles('HR_ADMIN')`, `@UseGuards(JwtAuthGuard)`) | Cross-cutting concern (auth, logging, validasi) terpisah dari logika bisnis inti. |
| **Adapter Pattern** | Integrasi API eksternal (BPJS, core banking untuk transfer gaji, gateway notifikasi) | Jika provider berganti, cukup ganti adapter tanpa ubah service inti. |
| **Singleton (via DI container)** | Config service, logger, koneksi database | Satu instance konsisten di seluruh aplikasi, dikelola otomatis oleh dependency injection framework. |

**Prinsip SOLID yang wajib dijaga:**
- **S**ingle Responsibility: satu class = satu alasan untuk berubah (jangan campur logika absensi dengan logika payroll dalam satu service).
- **O**pen/Closed: tambah aturan pajak baru = tambah strategy baru, bukan edit `if-else` yang sudah ada.
- **L**iskov Substitution: semua implementasi `ICalculator` harus bisa saling gantikan tanpa merusak pemanggilnya.
- **I**nterface Segregation: interface kecil dan spesifik (`ITaxCalculator`, `IOvertimeCalculator`), bukan satu interface besar `IPayrollEverything`.
- **D**ependency Inversion: Service bergantung pada interface repository (`IEmployeeRepository`), bukan implementasi konkret — memudahkan mocking saat testing.

---

## 4. Konvensi Kode (Coding Standard)

- **Naming:**
  - File: `kebab-case.type.ts` (contoh: `payroll.service.ts`, `overtime.calculator.ts`)
  - Class: `PascalCase` (contoh: `PayrollService`, `PPh21Calculator`)
  - Variabel/fungsi: `camelCase`
  - Konstanta global: `UPPER_SNAKE_CASE` (contoh: `MAX_RADIUS_METERS`)
  - Tabel & kolom database: `snake_case` (contoh: `employee_id`, `check_in_time`)
- **Response API konsisten** (bungkus semua response dalam format standar):
  ```json
  {
    "success": true,
    "data": { },
    "message": "Optional message",
    "meta": { "page": 1, "totalPages": 5 }
  }
  ```
  Error format:
  ```json
  {
    "success": false,
    "errorCode": "ATTENDANCE_OUT_OF_RADIUS",
    "message": "Anda berada di luar radius kantor",
    "details": { "distanceMeters": 320 }
  }
  ```
- **Versioning API**: prefix `/api/v1/...` sejak awal, agar breaking change di masa depan tidak merusak client lama.
- **Environment config**: tidak ada credential/hardcode di kode. Semua lewat `.env` + validasi schema env saat boot (fail fast jika env tidak lengkap).
- **Logging terstruktur** (JSON log) dengan level (`info`, `warn`, `error`) dan `requestId` untuk tracing.
- **Audit trail wajib** untuk aksi sensitif: siapa mengubah gaji karyawan, siapa approve cuti, kapan, dari IP mana — simpan di tabel `audit_logs`.
- **Testing**: minimum unit test untuk semua Calculator (payroll) dan Strategy (geofence). Target coverage logika bisnis kritikal ≥ 80%.
- **Idempotency** untuk endpoint generate payroll (jika dipanggil dua kali untuk periode yang sama, tidak boleh duplikat data — gunakan constraint unik `(employee_id, period_id)`).

---

## 5. Skema Database Lengkap (PostgreSQL)

> Tipe data indikatif; sesuaikan dengan ORM yang dipakai (Prisma/TypeORM/Sequelize). Semua tabel disarankan punya `id UUID`, `created_at`, `updated_at`, `deleted_at` (soft delete).

### 5.1 Core / Organisasi

```sql
companies (
  id UUID PK,
  name VARCHAR,
  npwp VARCHAR,
  address TEXT,
  created_at, updated_at
)

branches (
  id UUID PK,
  company_id UUID FK -> companies.id,
  name VARCHAR,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  radius_meters INT DEFAULT 100,
  created_at, updated_at
)

departments (
  id UUID PK,
  company_id UUID FK,
  name VARCHAR,
  parent_department_id UUID NULL FK -> departments.id
)

positions (
  id UUID PK,
  company_id UUID FK,
  title VARCHAR,
  level INT
)

shifts (
  id UUID PK,
  company_id UUID FK,
  name VARCHAR,             -- "Shift Pagi"
  start_time TIME,
  end_time TIME,
  tolerance_minutes INT DEFAULT 15
)

holidays (
  id UUID PK,
  company_id UUID FK,
  date DATE,
  name VARCHAR,
  is_national BOOLEAN
)
```

### 5.2 Karyawan & Auth

```sql
users (
  id UUID PK,
  email VARCHAR UNIQUE,
  phone VARCHAR UNIQUE,
  password_hash VARCHAR,
  role ENUM('SUPER_ADMIN','HR_ADMIN','MANAGER','EMPLOYEE','FINANCE'),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP
)

employees (
  id UUID PK,
  user_id UUID FK -> users.id,
  company_id UUID FK,
  branch_id UUID FK,
  department_id UUID FK,
  position_id UUID FK,
  manager_id UUID NULL FK -> employees.id,  -- untuk approval berjenjang
  employee_code VARCHAR UNIQUE,
  full_name VARCHAR,
  nik VARCHAR,                 -- KTP, enkripsi at-rest
  npwp VARCHAR NULL,           -- enkripsi at-rest
  bank_account_no VARCHAR,     -- enkripsi at-rest
  bank_name VARCHAR,
  employment_type ENUM('PKWTT','PKWT','HARIAN','MAGANG'),
  join_date DATE,
  resign_date DATE NULL,
  marital_status ENUM('TK','K'),      -- untuk PTKP
  dependents_count INT DEFAULT 0,     -- jumlah tanggungan, untuk PTKP
  status ENUM('ACTIVE','INACTIVE','RESIGNED')
)

employee_documents (
  id UUID PK,
  employee_id UUID FK,
  type VARCHAR,          -- 'KTP','KONTRAK','IJAZAH', dst
  file_url VARCHAR,
  uploaded_at TIMESTAMP
)

employee_shift_assignments (
  id UUID PK,
  employee_id UUID FK,
  shift_id UUID FK,
  effective_date DATE,
  end_date DATE NULL
)
```

### 5.3 Absensi (Radius/Geofencing)

```sql
attendances (
  id UUID PK,
  employee_id UUID FK,
  branch_id UUID FK,
  shift_id UUID FK,
  attendance_date DATE,
  check_in_time TIMESTAMP NULL,
  check_in_lat DECIMAL(10,7) NULL,
  check_in_lng DECIMAL(10,7) NULL,
  check_in_distance_meters DECIMAL(8,2) NULL,
  check_in_photo_url VARCHAR NULL,
  check_out_time TIMESTAMP NULL,
  check_out_lat DECIMAL(10,7) NULL,
  check_out_lng DECIMAL(10,7) NULL,
  check_out_distance_meters DECIMAL(8,2) NULL,
  status ENUM('ON_TIME','LATE','EARLY_LEAVE','ABSENT','ON_LEAVE','WFH'),
  work_duration_minutes INT NULL,
  UNIQUE(employee_id, attendance_date)
)

attendance_corrections (
  id UUID PK,
  attendance_id UUID FK NULL,
  employee_id UUID FK,
  requested_date DATE,
  reason TEXT,
  requested_check_in TIMESTAMP NULL,
  requested_check_out TIMESTAMP NULL,
  status ENUM('PENDING','APPROVED','REJECTED'),
  approved_by UUID NULL FK -> employees.id,
  approved_at TIMESTAMP NULL
)

overtime_requests (
  id UUID PK,
  employee_id UUID FK,
  date DATE,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  reason TEXT,
  status ENUM('PENDING','APPROVED','REJECTED'),
  approved_by UUID NULL FK
)
```

### 5.4 Cuti & Izin

```sql
leave_types (
  id UUID PK,
  company_id UUID FK,
  name VARCHAR,              -- 'Cuti Tahunan','Cuti Sakit','Cuti Melahirkan', dst
  is_paid BOOLEAN DEFAULT TRUE,
  default_days_per_year INT NULL,
  requires_attachment BOOLEAN DEFAULT FALSE
)

leave_balances (
  id UUID PK,
  employee_id UUID FK,
  leave_type_id UUID FK,
  year INT,
  entitled_days DECIMAL(5,2),
  used_days DECIMAL(5,2) DEFAULT 0,
  carried_over_days DECIMAL(5,2) DEFAULT 0,
  UNIQUE(employee_id, leave_type_id, year)
)

leave_requests (
  id UUID PK,
  employee_id UUID FK,
  leave_type_id UUID FK,
  start_date DATE,
  end_date DATE,
  total_days DECIMAL(5,2),
  reason TEXT,
  attachment_url VARCHAR NULL,
  status ENUM('PENDING','APPROVED','REJECTED','CANCELLED'),
  current_approval_level INT DEFAULT 1
)

leave_approvals (
  id UUID PK,
  leave_request_id UUID FK,
  approver_id UUID FK -> employees.id,
  level INT,
  status ENUM('PENDING','APPROVED','REJECTED'),
  comment TEXT,
  acted_at TIMESTAMP NULL
)
```

### 5.5 Payroll & Kepatuhan

```sql
salary_components (
  id UUID PK,
  company_id UUID FK,
  name VARCHAR,               -- 'Gaji Pokok','Tunjangan Transport', dst
  type ENUM('EARNING','DEDUCTION'),
  is_taxable BOOLEAN,
  is_fixed BOOLEAN
)

employee_salary_structures (
  id UUID PK,
  employee_id UUID FK,
  salary_component_id UUID FK,
  amount DECIMAL(15,2),
  effective_date DATE,
  end_date DATE NULL
)

tax_ptkp_settings (          -- master PTKP, histori per tahun berlaku
  id UUID PK,
  status VARCHAR,            -- 'TK0','K0','K1', dst
  annual_amount DECIMAL(15,2),
  effective_year INT
)

tax_ter_rates (               -- tabel TER PPh21, histori per tahun berlaku
  id UUID PK,
  category VARCHAR,           -- 'A','B','C'
  income_from DECIMAL(15,2),
  income_to DECIMAL(15,2),
  rate DECIMAL(5,4),
  effective_year INT
)

bpjs_settings (                -- persentase iuran, histori per periode berlaku
  id UUID PK,
  type ENUM('JHT','JKK','JKM','JP','KESEHATAN'),
  company_percentage DECIMAL(5,4),
  employee_percentage DECIMAL(5,4),
  max_salary_base DECIMAL(15,2) NULL,
  effective_date DATE
)

payroll_periods (
  id UUID PK,
  company_id UUID FK,
  period_month INT,
  period_year INT,
  status ENUM('DRAFT','GENERATED','APPROVED','PAID','LOCKED'),
  generated_at TIMESTAMP NULL,
  approved_by UUID NULL FK,
  UNIQUE(company_id, period_month, period_year)
)

payroll_items (
  id UUID PK,
  payroll_period_id UUID FK,
  employee_id UUID FK,
  gross_salary DECIMAL(15,2),
  total_overtime DECIMAL(15,2) DEFAULT 0,
  total_deduction_unpaid DECIMAL(15,2) DEFAULT 0,
  bpjs_company_total DECIMAL(15,2),
  bpjs_employee_total DECIMAL(15,2),
  pph21_amount DECIMAL(15,2),
  net_salary DECIMAL(15,2),
  UNIQUE(payroll_period_id, employee_id)
)

payroll_item_details (        -- rincian per komponen, untuk slip gaji transparan
  id UUID PK,
  payroll_item_id UUID FK,
  component_name VARCHAR,
  component_type ENUM('EARNING','DEDUCTION'),
  amount DECIMAL(15,2)
)

payslips (
  id UUID PK,
  payroll_item_id UUID FK,
  file_url VARCHAR,
  generated_at TIMESTAMP
)

severance_calculations (       -- pesangon/PHK, sesuai PP 35/2021
  id UUID PK,
  employee_id UUID FK,
  termination_date DATE,
  reason VARCHAR,
  years_of_service DECIMAL(5,2),
  severance_pay DECIMAL(15,2),
  service_appreciation_pay DECIMAL(15,2),
  compensation_pay DECIMAL(15,2),
  calculated_at TIMESTAMP
)
```

### 5.6 Cross-cutting

```sql
audit_logs (
  id UUID PK,
  user_id UUID FK,
  action VARCHAR,            -- 'UPDATE_SALARY','APPROVE_LEAVE', dst
  entity_type VARCHAR,
  entity_id UUID,
  old_value JSONB NULL,
  new_value JSONB NULL,
  ip_address VARCHAR,
  created_at TIMESTAMP
)

notifications (
  id UUID PK,
  user_id UUID FK,
  title VARCHAR,
  body TEXT,
  type VARCHAR,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP
)
```

**Indexing penting:**
- `attendances(employee_id, attendance_date)` — query rekap bulanan sering dipakai
- `leave_requests(employee_id, status)`
- `payroll_items(payroll_period_id)`
- Semua kolom `*_at` yang dipakai filter rentang tanggal

---

## 6. Alur Kritis (High-Level Sequence)

**Absen masuk:**
`Mobile App → POST /attendance/check-in → Controller (validasi DTO) → AttendanceService → GeofenceStrategy.validate(lat,lng,branch) → jika valid: AttendanceRepository.save() → EventEmitter('attendance.checked_in') → NotificationService (async)`

**Generate payroll:**
`Admin trigger → PayrollController → PayrollService.generate(periodId)` di dalam **satu transaction**:
1. Ambil semua employee aktif
2. Ambil data absensi & cuti periode tsb (untuk potongan)
3. `PayrollCalculatorFactory.getCalculator(employee.employmentType)`
4. Hitung earning → hitung BPJS → hitung PPh21 (TER) → hitung net
5. Simpan `payroll_items` + `payroll_item_details`
6. Commit transaction, ubah status period jadi `GENERATED`
7. Emit event `payroll.generated` → generate PDF slip (job queue, tidak blocking request)

---

## 7. Checklist "Terlihat Profesional" (Code Review Checklist)

- [ ] Tidak ada logika bisnis di controller
- [ ] Semua angka uang pakai tipe `DECIMAL`, bukan `FLOAT` (hindari rounding error)
- [ ] Semua tabel rate/tarif (BPJS, PTKP, TER) punya kolom `effective_date`/`effective_year` — tidak pernah hardcode di kode
- [ ] Semua endpoint punya validasi DTO + response format konsisten
- [ ] Semua operasi multi-tabel dibungkus transaction
- [ ] Semua data sensitif (NIK, NPWP, no. rekening) terenkripsi at-rest
- [ ] Ada audit log untuk perubahan data gaji & approval
- [ ] Unit test untuk semua calculator payroll & strategy geofence
- [ ] Tidak ada `console.log`/`print` debug tersisa; pakai logger terstruktur
- [ ] README per modul menjelaskan cara pakai & dependency
