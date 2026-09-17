# Auth Module

Autentikasi (roadmap Phase 1): login (email/phone + password) dan refresh
access token via JWT. Sumber RBAC (`users.role`) yang dipakai `RolesGuard`
di semua modul lain.

## Dependency

- **Tidak bergantung pada modul lain.**
- **Diekspor**: `USER_REPOSITORY` (`IUserRepository`) — dipakai
  `EmployeeModule` untuk membuat baris `users` sekaligus `employees` dalam
  satu transaction saat `EmployeeService.create()`.

## Pattern

- Repository Pattern: `UserRepository implements IUserRepository`.
- Strategy Pattern (Passport): `JwtStrategy` — validasi access token,
  mengisi `request.user` (`AuthenticatedUser`) yang dipakai `RolesGuard` &
  `@CurrentUser()` di seluruh aplikasi.

## Endpoint

| Endpoint | Auth | Keterangan |
|---|---|---|
| `POST /auth/login` | Publik, di-throttle 5/menit | Brute-force mitigation (Phase 6) |
| `POST /auth/refresh` | Publik | Tukar refresh token → access token baru |

## Catatan

- Password di-hash lewat `common/utils/password.util.ts`, tidak pernah
  disimpan/dikembalikan plaintext.
- `EmployeeRepository` SENGAJA tidak memuat relasi `user` saat menampilkan
  data karyawan — entity `User` punya `passwordHash`, memuatnya akan
  membocorkan hash lewat response API.
