# Employee Module

Core HRIS (roadmap Phase 1) — data karyawan sebagai single source of truth
untuk seluruh modul lain (Attendance, Leave, Payroll, Reports).

## Dependency

- **Impor**: `AuthModule` (`USER_REPOSITORY`) — `EmployeeService.create()`
  membuat baris `users` + `employees` sekaligus dalam satu transaction
  (`employees.user_id` NOT NULL, §5.2).
- **Diekspor**: `EMPLOYEE_REPOSITORY` (`IEmployeeRepository`) — dipakai
  hampir semua modul lain: Attendance (branch/manager), Leave (manager/HR
  approval chain), Payroll (daftar employee aktif + data PTKP), Reports
  (scope company/branch/department).

## Pattern

- Repository Pattern: `EmployeeRepository implements IEmployeeRepository`,
  `EmployeeDocumentRepository implements IEmployeeDocumentRepository`
  (dipisah — Interface Segregation, §3 — karena siklus hidup upload/hapus
  dokumen berbeda dari data inti karyawan).
- Unit of Work: `TransactionRunner` untuk `create()` (users + employees).
- Data sensitif (`nik`, `npwp`, `bankAccountNo`) dienkripsi at-rest lewat
  `encryptedColumn` transformer (AES-256-GCM) — tipe kolom tetap varchar,
  transparan di level entity (baca/tulis otomatis terdekripsi/terenkripsi).

## Endpoint

| Endpoint | Role |
|---|---|
| `POST /employees` | SUPER_ADMIN, HR_ADMIN |
| `GET /employees`, `GET /employees/:id` | + MANAGER, FINANCE (baca saja) |
| `PUT /employees/:id`, `DELETE /employees/:id` | SUPER_ADMIN, HR_ADMIN |
| `GET /employees/me`, `PUT /employees/me` | Semua role terautentikasi (self-service) |
| `GET /employees/:id/documents` | SUPER_ADMIN, HR_ADMIN |
| `POST /employees/:id/documents` (multipart, field `file` + `type`) | SUPER_ADMIN, HR_ADMIN |
| `GET /employees/:id/documents/:documentId/download` | SUPER_ADMIN, HR_ADMIN |
| `DELETE /employees/:id/documents/:documentId` | SUPER_ADMIN, HR_ADMIN |

## Catatan

- Self-service (`/employees/me`) hanya mengizinkan update field non-kritis
  (`bankAccountNo`, `bankName`, lihat `UpdateMyProfileDto`) — identitas
  (NIK/NPWP/employeeCode), struktur organisasi, dan kredensial login tetap
  eksklusif lewat `PUT /employees/:id` (HR_ADMIN/SUPER_ADMIN) atau modul Auth.
  Rute `me` didaftarkan sebelum `:id` di controller agar tidak ditangkap
  `ParseUUIDPipe`.
- CRUD `employee_salary_structures` (struktur gaji per karyawan, §5.5) kini
  dikelola oleh `PayrollModule` (`PayrollService.assignSalaryStructure`),
  bukan modul ini — lihat `payroll/README.md`.
- Dokumen karyawan (§5.2) disimpan di **disk lokal** (`multer` diskStorage,
  direktori `EMPLOYEE_DOCUMENTS_UPLOAD_DIR`), bukan S3/MinIO — belum ada
  kredensial object storage. Volume Docker `employee_documents`
  (docker-compose.yml) menjaga file tetap ada saat container di-rebuild;
  `Dockerfile` men-chown direktori ini ke user `node` sebelum volume
  di-mount supaya proses non-root bisa menulis. Hanya PDF/JPG/PNG, maks
  5MB (`ALLOWED_DOCUMENT_EXTENSIONS`/`MAX_DOCUMENT_FILE_SIZE_BYTES` di
  `employee.controller.ts`). Hapus dokumen = soft-delete baris DB + hapus
  file fisik best-effort (kegagalan hapus file tidak membatalkan
  soft-delete).
