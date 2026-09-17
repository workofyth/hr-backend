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
import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { FindSalaryComponentsQueryDto } from './dto/find-salary-components-query.dto';
import { AssignSalaryStructureDto } from './dto/assign-salary-structure.dto';
import { FindSalaryStructuresQueryDto } from './dto/find-salary-structures-query.dto';
import { CreateBpjsSettingDto } from './dto/create-bpjs-setting.dto';
import { CreatePtkpSettingDto } from './dto/create-ptkp-setting.dto';
import { CreateTerRateDto } from './dto/create-ter-rate.dto';

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

  // ---------------------------------------------------------------------
  // Pengaturan payroll (admin-dashboard-web-hr.md §5) — create-only,
  // histori per effective_date/effective_year (checklist §8), tidak ada
  // update/delete di sini secara sengaja.
  // ---------------------------------------------------------------------

  @Get('salary-components')
  findSalaryComponents(@Query() query: FindSalaryComponentsQueryDto) {
    return this.payrollService.findSalaryComponents(query.companyId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('salary-components')
  createSalaryComponent(@Body() dto: CreateSalaryComponentDto) {
    return this.payrollService.createSalaryComponent(dto);
  }

  @Get('salary-structures')
  findSalaryStructures(@Query() query: FindSalaryStructuresQueryDto) {
    return this.payrollService.findSalaryStructures(query.employeeId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('salary-structures')
  assignSalaryStructure(@Body() dto: AssignSalaryStructureDto) {
    return this.payrollService.assignSalaryStructure(dto);
  }

  @Get('bpjs-settings')
  findBpjsSettings() {
    return this.payrollService.findAllBpjsSettings();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('bpjs-settings')
  createBpjsSetting(@Body() dto: CreateBpjsSettingDto) {
    return this.payrollService.createBpjsSetting(dto);
  }

  @Get('ptkp-settings')
  findPtkpSettings() {
    return this.payrollService.findAllPtkpSettings();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('ptkp-settings')
  createPtkpSetting(@Body() dto: CreatePtkpSettingDto) {
    return this.payrollService.createPtkpSetting(dto);
  }

  @Get('ter-rates')
  findTerRates() {
    return this.payrollService.findAllTerRates();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('ter-rates')
  createTerRate(@Body() dto: CreateTerRateDto) {
    return this.payrollService.createTerRate(dto);
  }
}
