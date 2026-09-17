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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { FindEmployeesQueryDto } from './dto/find-employees-query.dto';

/**
 * Hanya menerima request, validasi lewat DTO, dan memanggil EmployeeService
 * — tidak ada logika bisnis di sini (checklist §7 backend-architecture-hr.md).
 * Catatan: endpoint self-service ("karyawan lihat/update data sendiri") belum
 * dibuat di Phase 1 ini — endpoint di bawah untuk HR_ADMIN/SUPER_ADMIN
 * (kelola semua karyawan) dan MANAGER/FINANCE (baca saja, untuk approval &
 * payroll).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

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
