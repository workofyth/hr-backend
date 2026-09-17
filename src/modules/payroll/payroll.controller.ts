import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { CalculateThrQueryDto } from './dto/calculate-thr-query.dto';

/**
 * Hanya menerima request, validasi lewat DTO, dan memanggil PayrollService
 * — tidak ada logika bisnis di sini (checklist §7). Path endpoint mengikuti
 * "API Kunci" roadmap-aplikasi-hr.md Phase 4 persis. Seluruh endpoint
 * dibatasi HR_ADMIN/FINANCE/SUPER_ADMIN — data payroll sensitif, tidak ada
 * akses karyawan biasa pada fase ini (unduh slip gaji pribadi menyusul
 * bersama fitur slip PDF).
 */
@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('generate')
  generate(@Body() dto: GeneratePayrollDto) {
    return this.payrollService.generate(dto);
  }

  @Get(':id/detail')
  findDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.findDetail(id);
  }

  @Put(':id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.approve(user, id);
  }

  @Get('thr/:employeeId')
  calculateThr(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Query() query: CalculateThrQueryDto) {
    return this.payrollService.calculateThr(employeeId, query.referenceDate);
  }
}
