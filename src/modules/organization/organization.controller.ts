import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationService } from './organization.service';
import { FindByCompanyQueryDto } from './dto/find-by-company-query.dto';

/**
 * Endpoint read-only data referensi organisasi. Semua role yang sudah login
 * boleh baca (dipakai dropdown form, bukan data sensitif) — tidak ada
 * pembatasan RBAC tambahan di sini.
 */
@ApiTags('organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('companies')
  findCompanies() {
    return this.organizationService.findCompanies();
  }

  @Get('branches')
  findBranches(@Query() query: FindByCompanyQueryDto) {
    return this.organizationService.findBranches(query.companyId);
  }

  @Get('departments')
  findDepartments(@Query() query: FindByCompanyQueryDto) {
    return this.organizationService.findDepartments(query.companyId);
  }

  @Get('positions')
  findPositions(@Query() query: FindByCompanyQueryDto) {
    return this.organizationService.findPositions(query.companyId);
  }
}
