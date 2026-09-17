import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

interface AuthenticatedRequest {
  user?: { userId: string; role: UserRole };
}

/**
 * RBAC guard — backend-architecture-hr.md §3 & roadmap-aplikasi-hr.md Phase 1
 * ("Role-based access control (RBAC): Super Admin, HR Admin, Manager,
 * Employee, Finance"). Harus dipasang SETELAH JwtAuthGuard supaya
 * `request.user` sudah terisi.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Anda tidak memiliki akses untuk aksi ini');
    }

    return true;
  }
}
