# Admin Dashboard (Web Backoffice) — Aplikasi HR

Dokumen pendamping dari `roadmap-aplikasi-hr.md`, `backend-architecture-hr.md`, dan `frontend-mobile-architecture-hr.md`. Fokus dokumen ini: **web dashboard** untuk HR Admin, Manager, dan Finance — dipakai dari browser (laptop/desktop), terpisah dari mobile app karyawan.

**Kenapa perlu dashboard web terpisah dari mobile app?**
Mobile app fokus untuk karyawan (absen, ajukan cuti, lihat slip gaji) — layar kecil, aksi ringan. Sedangkan HR Admin/Finance butuh: tabel data besar, filter kompleks, generate payroll massal, monitoring real-time banyak karyawan sekaligus, export laporan — semua ini jauh lebih nyaman dikerjakan di layar lebar/web, bukan di HP.

---

## 1. Cakupan Pengguna Dashboard

| Role | Akses Utama |
|---|---|
| **Super Admin** | Semua modul + pengaturan perusahaan, cabang, kebijakan |
| **HR Admin** | Employee management, attendance monitoring, leave approval/konfigurasi, payroll generation, laporan |
| **Manager** | Approval cuti tim, monitoring kehadiran tim (read-only untuk data di luar timnya) |
| **Finance** | Payroll (view, approve, export transfer bank), laporan pajak/BPJS |

RBAC ini **sama persis** dengan role di `backend-architecture-hr.md` §5.2 (`users.role`) — dashboard tidak mendefinisikan role baru.

---

## 2. Prinsip Arsitektur

Sama seperti mobile app: **Clean Architecture** dengan pemisahan Presentation → Domain (hooks/use case) → Data (API client).

**Rekomendasi Stack:**
- Framework: **Next.js (React)** — SSR/SSG untuk dashboard yang cepat, App Router
- State/data-fetching: **TanStack Query (React Query)** untuk server state (cache, refetch, loading state otomatis) + **Zustand** untuk UI state lokal (sidebar collapse, modal, dll)
- Form: **React Hook Form + Zod** (validasi schema sama gaya dengan DTO backend)
- Tabel data: **TanStack Table** (sorting, filtering, pagination server-side untuk data besar seperti payroll ratusan karyawan)
- UI Components: **shadcn/ui** (headless, gampang di-theming, gratis) di atas Tailwind CSS
- Chart: **Recharts** untuk dashboard statistik (headcount, tren kehadiran, biaya payroll)

**Aturan wajib (sama semangat dengan mobile):**
- Komponen halaman (`page.tsx`) **tidak boleh** fetch data langsung dengan fetch/axios sembarangan — selalu lewat custom hook (`useEmployees()`, `usePayrollPeriod()`) yang membungkus React Query.
- Semua request ke backend memakai kontrak response yang sama dengan `backend-architecture-hr.md` §4 (format `success/data/message/meta`).
- Tidak ada logika bisnis (perhitungan payroll, validasi saldo cuti) dihitung ulang di frontend — dashboard hanya menampilkan hasil dari backend, kecuali validasi form dasar (required, format angka).

---

## 3. Struktur Folder (Next.js App Router)

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # sidebar + topbar shared layout
│   │   ├── overview/page.tsx         # dashboard utama (statistik ringkas)
│   │   ├── employees/
│   │   │   ├── page.tsx              # list + filter
│   │   │   └── [id]/page.tsx         # detail/edit karyawan
│   │   ├── attendance/
│   │   │   ├── monitoring/page.tsx   # real-time siapa sudah/belum absen
│   │   │   ├── corrections/page.tsx  # approval koreksi absensi
│   │   │   └── reports/page.tsx
│   │   ├── leave/
│   │   │   ├── approvals/page.tsx
│   │   │   ├── types/page.tsx        # konfigurasi jenis cuti
│   │   │   └── reports/page.tsx
│   │   ├── payroll/
│   │   │   ├── periods/page.tsx      # list periode payroll
│   │   │   ├── periods/[id]/page.tsx # detail: generate, review, approve
│   │   │   ├── components/page.tsx   # konfigurasi salary components
│   │   │   └── tax-settings/page.tsx # PTKP/TER/BPJS rate settings
│   │   ├── organization/
│   │   │   ├── branches/page.tsx
│   │   │   ├── departments/page.tsx
│   │   │   └── shifts/page.tsx
│   │   └── settings/page.tsx
│   │
├── components/
│   ├── ui/                # shadcn/ui base components (button, dialog, table, dll)
│   ├── layout/             # Sidebar, Topbar, Breadcrumb
│   └── shared/             # DataTable wrapper, StatusBadge, ConfirmDialog, EmptyState
│
├── features/               # domain logic per modul (mirror ke mobile app)
│   ├── employee/
│   │   ├── api/employee.api.ts        # fetch functions
│   │   ├── hooks/use-employees.ts     # react-query hooks
│   │   ├── schema/employee.schema.ts  # zod schema (selaras DTO backend)
│   │   └── types/employee.types.ts
│   ├── attendance/
│   ├── leave/
│   └── payroll/
│
├── lib/
│   ├── api-client.ts       # axios instance + interceptor (token, error mapping)
│   ├── auth.ts             # session handling
│   └── utils.ts
│
└── styles/
    └── theme.css            # design tokens (selaras §6 dokumen ini)
```

---

## 4. Design Pattern

| Pattern | Dipakai di | Kenapa |
|---|---|---|
| **Custom Hook sebagai Repository** | `use-employees.ts`, `use-payroll.ts` | Membungkus React Query, page component tidak perlu tahu detail fetching/caching. |
| **Compound Component** | `DataTable` (table + filter + pagination jadi satu unit) | Konsisten dipakai ulang di Employee, Attendance, Payroll tanpa duplikasi logic tabel. |
| **Adapter/Mapper** | `*.schema.ts` ↔ tipe respons backend | Isolasi perubahan struktur API dari komponen UI. |
| **Strategy** | Render kolom status berbeda per modul (`StatusBadge` dengan varian ON_TIME/LATE/PENDING/APPROVED) | Satu komponen, banyak varian tampilan tanpa `if-else` menumpuk di tempat pemakaian. |
| **Facade** | `payrollGenerationFlow()` yang membungkus multi-step (validasi periode → generate → review → approve) jadi satu alur terpandu di UI wizard | Proses payroll berisiko tinggi, UI harus memandu step-by-step, bukan satu form besar. |
| **Container/Presentational split** | Setiap `page.tsx` (container: fetch & state) vs komponen di `components/shared` (presentational: murni tampilan) | Memudahkan testing komponen visual terpisah dari logic data. |

---

## 5. Fitur per Modul (selaras `roadmap-aplikasi-hr.md`)

### Overview / Dashboard Utama
- Kartu ringkasan: total karyawan aktif, tingkat kehadiran hari ini, cuti aktif, status payroll bulan berjalan
- Grafik tren kehadiran & turnover (Recharts)
- Notifikasi/alert: pengajuan cuti/koreksi absensi yang butuh approval

### Employee Management
- Tabel karyawan dengan filter (cabang, departemen, status, jenis kontrak) + search
- Form tambah/edit karyawan (selaras skema `employees` di backend)
- Upload dokumen karyawan
- Riwayat mutasi/promosi

### Attendance Monitoring
- Tabel real-time status absensi hari ini per karyawan (auto-refresh via polling/React Query `refetchInterval`)
- Peta kecil menampilkan titik check-in vs radius kantor (untuk audit kasus mencurigakan)
- Approval antrian koreksi absensi & lembur
- Export rekap bulanan (Excel/PDF)

### Leave Management
- Konfigurasi jenis cuti (nama, default hari, wajib lampiran atau tidak)
- Kalender tim (lihat siapa cuti kapan)
- Antrian approval (untuk Manager/HR) dengan aksi cepat approve/reject + komentar
- Laporan saldo & penggunaan cuti per karyawan/departemen

### Payroll (modul paling sensitif — UI wizard, bukan form bebas)
- **Step 1**: Pilih periode → sistem cek data absensi/cuti sudah lengkap
- **Step 2**: Generate → tampilkan progress, lalu hasil per karyawan dalam tabel (gross, BPJS, PPh21, net)
- **Step 3**: Review detail per karyawan (klik row → breakdown lengkap seperti slip gaji)
- **Step 4**: Approval berjenjang (HR generate → Finance approve → Lock)
- **Step 5**: Export untuk transfer bank + export laporan pajak/BPJS
- Halaman terpisah untuk konfigurasi `salary_components`, `tax_ptkp_settings`, `tax_ter_rates`, `bpjs_settings` — histori per tanggal berlaku, **tidak boleh** edit langsung angka yang sudah dipakai payroll periode lampau (harus buat entry baru dengan `effective_date` baru, demi audit trail)

### Organization Settings
- Kelola cabang (termasuk titik lokasi & radius geofence)
- Kelola departemen, jabatan, shift, hari libur

### Audit & Laporan
- Log audit (`audit_logs`) dengan filter per user/aksi/tanggal
- Export semua laporan dalam format Excel/PDF/CSV

---

## 6. Design System (selaras semangat mobile app, disesuaikan untuk web)

Dashboard **tidak perlu identik pixel-by-pixel** dengan mobile app, tapi tetap satu bahasa visual (brand konsisten):
- Font: sama — **Satoshi** untuk heading, **Inter/Plus Jakarta Sans** untuk body
- Warna: token sama dengan mobile (`colorPrimary`, dst dari `frontend-mobile-architecture-hr.md` §9), tapi dashboard boleh lebih netral/"kerja" (banyak putih, aksen dipakai secukupnya di CTA/status)
- Radius & spacing: skala sama (8/16/24/32, radius 12–16px untuk card web — sedikit lebih kecil dari mobile karena densitas informasi lebih tinggi)
- Ikon: tetap Phosphor/Lucide
- Density: dashboard boleh lebih padat (tabel banyak baris) dibanding mobile yang harus lega — ini pengecualian yang wajar untuk konteks kerja di layar besar
- State kosong & loading: pakai skeleton table (bukan spinner tengah layar) agar terasa responsif saat data banyak

---

## 7. Keamanan Khusus Dashboard

- Session timeout lebih ketat dibanding mobile (misal auto-logout 30 menit idle) karena dashboard sering diakses dari komputer bersama/kantor
- Setiap aksi sensitif (approve payroll, ubah rate pajak, ubah data karyawan) tampilkan **confirm dialog** dengan ringkasan perubahan sebelum submit
- Tampilkan watermark/identitas user yang sedang login di setiap halaman export (PDF/Excel) untuk audit
- Role Finance tidak bisa mengedit data karyawan; Role HR Admin tidak bisa "un-approve" payroll yang sudah di-lock Finance — tegakkan lewat backend, tapi UI juga sembunyikan aksi yang tidak diizinkan (defense in depth, bukan pengganti validasi backend)

---

## 8. Checklist "Terlihat Profesional" (Dashboard Review)

- [ ] Tidak ada fetch data langsung di dalam komponen `page.tsx`, semua lewat custom hook
- [ ] Tabel besar (payroll, attendance) pakai pagination/filter server-side, bukan load semua data lalu filter di client
- [ ] Proses payroll memakai UI wizard bertahap, bukan satu tombol "Generate" tanpa konfirmasi
- [ ] Semua perubahan rate/tarif tersimpan sebagai entry baru (histori), tidak pernah overwrite data lama
- [ ] Aksi approve/reject/lock selalu ada confirm dialog dengan ringkasan dampak
- [ ] Role-based UI: menu/aksi yang tidak sesuai role user disembunyikan
- [ ] Skeleton loading dipakai di semua tabel/kartu data, tidak ada layar kosong tanpa feedback
- [ ] Semua export (Excel/PDF) mencantumkan metadata (tanggal generate, oleh siapa)
