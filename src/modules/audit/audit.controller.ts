import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuditLogService } from '../../common/services/audit-log.service';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

/**
 * Audit log viewer (admin-dashboard-web-hr.md) — hanya menerima request,
 * validasi lewat DTO, dan memanggil AuditLogService (checklist §7).
 * Read-only: audit_logs bersifat append-only, tidak ada endpoint
 * create/update/delete di sini — baris ditulis lewat `AuditLogService.record()`
 * dari modul lain (Payroll, Leave, Attendance).
 */
@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(@Query() query: FindAuditLogsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const { items, total } = await this.auditLogService.findAll({ ...query, page, limit });
    return {
      data: items,
      meta: { page, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }
}
