import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Response } from 'express';
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
import { UploadEmployeeDocumentDto } from './dto/upload-employee-document.dto';
import { FindEmployeesQueryDto } from './dto/find-employees-query.dto';
import { EMPLOYEE_DOCUMENTS_UPLOAD_DIR } from './employee.constants';

const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

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

  // ---------------------------------------------------------------------
  // Dokumen karyawan (§5.2, roadmap Phase 1 "Upload dokumen karyawan") —
  // disk lokal (belum ada kredensial S3/MinIO, lihat README modul ini).
  // ---------------------------------------------------------------------

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Get(':id/documents')
  findDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.findDocuments(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: EMPLOYEE_DOCUMENTS_UPLOAD_DIR,
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extname(file.originalname).toLowerCase())) {
          callback(new BadRequestException('Tipe file tidak didukung (hanya PDF/JPG/PNG)'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File wajib diunggah');
    }
    return this.employeeService.addDocument(id, dto.type, file.filename);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Get(':id/documents/:documentId/download')
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ) {
    const document = await this.employeeService.getDocumentForDownload(id, documentId);
    res.download(`${EMPLOYEE_DOCUMENTS_UPLOAD_DIR}/${document.fileUrl}`, `${document.type}${extname(document.fileUrl)}`);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete(':id/documents/:documentId')
  removeDocument(@Param('id', ParseUUIDPipe) id: string, @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.employeeService.removeDocument(id, documentId);
  }
}
