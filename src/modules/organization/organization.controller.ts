import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { OrganizationService } from './organization.service';
import { FindByCompanyQueryDto } from './dto/find-by-company-query.dto';
import { FindHolidaysQueryDto } from './dto/find-holidays-query.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

/**
 * Data referensi organisasi. Read (GET) terbuka untuk semua role yang
 * sudah login (dipakai dropdown form, bukan data sensitif). Write
 * (POST/PUT) dibatasi SUPER_ADMIN/HR_ADMIN — admin-dashboard-web-hr.md §1:
 * "Super Admin: ... pengaturan perusahaan, cabang, kebijakan".
 */
@ApiTags('organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  // --- Companies ---

  @Get('companies')
  findCompanies() {
    return this.organizationService.findCompanies();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('companies')
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.organizationService.createCompany(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put('companies/:id')
  updateCompany(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
    return this.organizationService.updateCompany(id, dto);
  }

  // --- Branches ---

  @Get('branches')
  findBranches(@Query() query: FindByCompanyQueryDto) {
    return this.organizationService.findBranches(query.companyId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.organizationService.createBranch(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put('branches/:id')
  updateBranch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.organizationService.updateBranch(id, dto);
  }

  // --- Departments ---

  @Get('departments')
  findDepartments(@Query() query: FindByCompanyQueryDto) {
    return this.organizationService.findDepartments(query.companyId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('departments')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.organizationService.createDepartment(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put('departments/:id')
  updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.organizationService.updateDepartment(id, dto);
  }

  // --- Positions ---

  @Get('positions')
  findPositions(@Query() query: FindByCompanyQueryDto) {
    return this.organizationService.findPositions(query.companyId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('positions')
  createPosition(@Body() dto: CreatePositionDto) {
    return this.organizationService.createPosition(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put('positions/:id')
  updatePosition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePositionDto) {
    return this.organizationService.updatePosition(id, dto);
  }

  // --- Shifts ---

  @Get('shifts')
  findShifts(@Query() query: FindByCompanyQueryDto) {
    return this.organizationService.findShifts(query.companyId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('shifts')
  createShift(@Body() dto: CreateShiftDto) {
    return this.organizationService.createShift(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put('shifts/:id')
  updateShift(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShiftDto) {
    return this.organizationService.updateShift(id, dto);
  }

  // --- Holidays ---

  @Get('holidays')
  findHolidays(@Query() query: FindHolidaysQueryDto) {
    return this.organizationService.findHolidays(query.companyId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('holidays')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.organizationService.createHoliday(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put('holidays/:id')
  updateHoliday(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHolidayDto) {
    return this.organizationService.updateHoliday(id, dto);
  }
}
