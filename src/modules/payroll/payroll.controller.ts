import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
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
import { FindPeriodsQueryDto } from './dto/find-periods-query.dto';
import { CalculateSeveranceDto } from './dto/calculate-severance.dto';
import { FindSeveranceCalculationsQueryDto } from './dto/find-severance-calculations-query.dto';
import { CalculatePph21ReconciliationQueryDto } from './dto/calculate-pph21-reconciliation-query.dto';
import { PAYSLIPS_UPLOAD_DIR } from './payroll.constants';

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

  @Get('periods')
  async findPeriods(@Query() query: FindPeriodsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const result = await this.payrollService.findPeriods(query.companyId, page, limit);
    return {
      data: result.items,
      meta: { page: result.page, totalPages: Math.max(1, Math.ceil(result.total / result.limit)) },
    };
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

  /**
   * Rekonsiliasi tahunan PPh21 — read-only, tidak menulis ke payroll_items
   * manapun (lihat catatan di `PayrollService.calculatePph21Reconciliation`).
   */
  @Get('pph21-annual-reconciliation')
  calculatePph21Reconciliation(@Query() query: CalculatePph21ReconciliationQueryDto) {
    return this.payrollService.calculatePph21Reconciliation(query.employeeId, query.year);
  }

  /**
   * Generate (jika belum ada) & unduh slip gaji PDF satu payroll_item.
   * Idempotent — panggilan berulang mengembalikan file yang sama, tidak
   * generate ulang (lihat `PayrollService.generatePayslip`).
   */
  @Get('items/:payrollItemId/payslip')
  async downloadPayslip(@Param('payrollItemId', ParseUUIDPipe) payrollItemId: string, @Res() res: Response) {
    const payslip = await this.payrollService.generatePayslip(payrollItemId);
    res.download(`${PAYSLIPS_UPLOAD_DIR}/${payslip.fileUrl}`, 'slip-gaji.pdf');
  }

  // ---------------------------------------------------------------------
  // Pesangon/PHK (§5.5, PP 35/2021) — lihat catatan penting soal
  // multiplier di SeveranceCalculator & CalculateSeveranceDto.
  // ---------------------------------------------------------------------

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('severance')
  calculateSeverance(@Body() dto: CalculateSeveranceDto) {
    return this.payrollService.calculateSeverance(dto);
  }

  @Get('severance')
  findSeveranceCalculations(@Query() query: FindSeveranceCalculationsQueryDto) {
    return this.payrollService.findSeveranceCalculations(query.employeeId);
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
