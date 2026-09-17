# Organization Module

Data referensi Core/Organisasi (§5.1): `companies`, `branches`,
`departments`, `positions`. Read-only — dipakai untuk populate dropdown di
Admin Dashboard & form create/update karyawan.

## Dependency

- **Tidak bergantung pada modul lain**, tidak mengekspor apa pun (belum ada
  modul yang butuh baca data ini lewat repository interface — semua akses
  lewat HTTP endpoint di bawah).

## Pattern

Sengaja **TANPA** repository interface terpisah (`IOrganizationRepository`)
— berbeda dari modul fitur lain (Attendance/Leave/Payroll). `OrganizationService`
langsung `@InjectRepository()` ke `Company`/`Branch`/`Department`/`Position`
karena murni baca data referensi tanpa logika bisnis. Kalau modul ini nanti
butuh CRUD penuh (create/update/delete), refactor ke Repository Pattern
penuh (interface + implementasi) mengikuti pola modul lain.

## Endpoint

`GET /companies`, `/branches`, `/departments`, `/positions` (dengan filter
`companyId` opsional, tanpa prefix `/organization` — mengikuti gaya path
flat di roadmap-aplikasi-hr.md, bukan dinaungi nama modul). Semua
read-only — **tidak ada
create/update/delete di sini**; perubahan data organisasi masih lewat
migration/SQL manual sampai ada kebutuhan CRUD penuh (backend-architecture-hr.md §2).
