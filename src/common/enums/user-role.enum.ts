/**
 * RBAC role — backend-architecture-hr.md §5.2 (users.role) dan
 * roadmap-aplikasi-hr.md Phase 1 ("Role-based access control (RBAC):
 * Super Admin, HR Admin, Manager, Employee, Finance").
 *
 * Ditempatkan di common/ (bukan di dalam modules/auth) supaya guard &
 * decorator RBAC lintas modul tidak perlu bergantung pada modul auth.
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HR_ADMIN = 'HR_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  FINANCE = 'FINANCE',
}
