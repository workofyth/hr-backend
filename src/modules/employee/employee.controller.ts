import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { FindEmployeesQueryDto } from './dto/find-employees-query.dto';

/**
 * Hanya menerima request, validasi lewat DTO, dan memanggil EmployeeService
 * — tidak ada logika bisnis di sini (checklist §7 backend-architecture-hr.md).
 * Rute `me` didaftarkan sebelum `:id` supaya tidak ditangkap ParseUUIDPipe.
 * Endpoint `:id` untuk HR_ADMIN/SUPER_ADMIN (kelola semua karyawan) dan
 * MANAGER/FINANCE (baca saja, untuk approval & payroll); endpoint `me`
 * untuk self-service (roadmap Phase 1), terbuka ke semua role terautentikasi.
 */
@ApiTags('employee')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.employeeService.findMe(user.userId);
  }

  @Put('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMyProfileDto) {
    return this.employeeService.updateMe(user.userId, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.FINANCE)
  @Get()
  async findAll(@Query() query: FindEmployeesQueryDto) {
    const result = await this.employeeService.findAll(query);
    return {
      data: result.items,
      meta: {
        page: result.page,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.FINANCE)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeeService.update(id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.remove(id);
  }
}
