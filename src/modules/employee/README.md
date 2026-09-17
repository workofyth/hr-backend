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

- Repository Pattern: `EmployeeRepository implements IEmployeeRepository`.
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

## Catatan

- Belum ada endpoint self-service ("karyawan lihat/update data sendiri") —
  di luar cakupan Phase 1 yang sudah dikerjakan.
- Belum ada CRUD `employee_salary_structures` (struktur gaji per karyawan,
  §5.5) — saat ini diisi lewat migration/SQL manual, dibaca read-only oleh
  `PayrollModule`. Bila dibangun, sertakan audit log (checklist §7).
