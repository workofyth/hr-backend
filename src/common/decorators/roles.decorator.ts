import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorator Pattern — backend-architecture-hr.md §3:
 * "@Roles('HR_ADMIN')" untuk membatasi endpoint per role RBAC.
 * Dipasangkan dengan RolesGuard (perlu JwtAuthGuard berjalan lebih dulu
 * agar `request.user` terisi).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
