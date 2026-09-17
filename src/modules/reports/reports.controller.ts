import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ReportsService } from './reports.service';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { LeaveSummaryQueryDto } from './dto/leave-summary-query.dto';
import { PayrollSummaryQueryDto } from './dto/payroll-summary-query.dto';
import { HeadcountSummaryQueryDto } from './dto/headcount-summary-query.dto';

/**
 * Hanya menerima request, validasi lewat DTO, dan memanggil ReportsService
 * — tidak ada logika bisnis di sini (checklist §7). Cakupan modul ini
 * (roadmap Phase 5) dibatasi ke 3 laporan ringkasan yang diminta —
 * dashboard headcount/turnover, grafik tren, dan export Excel/PDF BELUM
 * termasuk di sini.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER)
  @Get('attendance-summary')
  getAttendanceSummary(@Query() query: AttendanceSummaryQueryDto) {
    return this.reportsService.getAttendanceSummary(query);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER)
  @Get('leave-summary')
  getLeaveSummary(@Query() query: LeaveSummaryQueryDto) {
    return this.reportsService.getLeaveSummary(query);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE)
  @Get('payroll-summary')
  getPayrollSummary(@Query() query: PayrollSummaryQueryDto) {
    return this.reportsService.getPayrollSummary(query);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.FINANCE)
  @Get('headcount-summary')
  getHeadcountSummary(@Query() query: HeadcountSummaryQueryDto) {
    return this.reportsService.getHeadcountSummary(query);
  }
}
