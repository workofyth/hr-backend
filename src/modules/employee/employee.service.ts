import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { unlink } from 'fs';
import { join } from 'path';
import { EMPLOYEE_REPOSITORY, EMPLOYEE_DOCUMENT_REPOSITORY, EMPLOYEE_DOCUMENTS_UPLOAD_DIR } from './employee.constants';
import { IEmployeeRepository } from './employee-repository.interface';
import { IEmployeeDocumentRepository } from './employee-document-repository.interface';
import { USER_REPOSITORY } from '../auth/auth.constants';
import { IUserRepository } from '../auth/user-repository.interface';
import { TRANSACTION_RUNNER, TransactionRunner } from '../../database/transaction-runner';
import { hashPassword } from '../../common/utils/password.util';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { Employee, EmployeeStatus } from './entities/employee.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { UserRole } from '../../common/enums/user-role.enum';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export interface FindAllResult {
  items: Employee[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Logika bisnis modul Employee — roadmap-aplikasi-hr.md Phase 1.
 * Bergantung pada IEmployeeRepository & IUserRepository (Dependency
 * Inversion, §3), tidak tahu detail HTTP, dan bisa di-unit-test dengan
 * mock repository.
 */
@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: IEmployeeRepository,
    @Inject(EMPLOYEE_DOCUMENT_REPOSITORY) private readonly employeeDocumentRepository: IEmployeeDocumentRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactionRunner: TransactionRunner,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const existing = await this.employeeRepository.findByEmployeeCode(dto.employeeCode);
    if (existing) {
      throw new ConflictException(`Kode karyawan "${dto.employeeCode}" sudah digunakan`);
    }

    try {
      return await this.transactionRunner.run(async (manager) => {
        const passwordHash = await hashPassword(dto.password);
        const user = await this.userRepository.create(
          {
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            role: dto.role ?? UserRole.EMPLOYEE,
          },
          manager,
        );

        return this.employeeRepository.create(
          {
            userId: user.id,
            companyId: dto.companyId,
            branchId: dto.branchId,
            departmentId: dto.departmentId,
            positionId: dto.positionId,
            managerId: dto.managerId ?? null,
            employeeCode: dto.employeeCode,
            fullName: dto.fullName,
            nik: dto.nik,
            npwp: dto.npwp ?? null,
            bankAccountNo: dto.bankAccountNo,
            bankName: dto.bankName,
            employmentType: dto.employmentType,
            joinDate: dto.joinDate,
            maritalStatus: dto.maritalStatus,
            dependentsCount: dto.dependentsCount ?? 0,
            status: EmployeeStatus.ACTIVE,
          },
          manager,
        );
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('Email, nomor HP, atau kode karyawan sudah terdaftar');
      }
      throw error;
    }
  }

  async findAll(query: { page?: number; limit?: number }): Promise<FindAllResult> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const { items, total } = await this.employeeRepository.findAll({ page, limit });
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException('Karyawan tidak ditemukan');
    }
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    await this.findOne(id);
    return this.employeeRepository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.employeeRepository.softDelete(id);
  }

  async findMe(userId: string): Promise<Employee> {
    const employee = await this.employeeRepository.findByUserId(userId);
    if (!employee) {
      throw new NotFoundException('Data karyawan untuk akun ini tidak ditemukan');
    }
    return employee;
  }

  async updateMe(userId: string, dto: UpdateMyProfileDto): Promise<Employee> {
    const employee = await this.findMe(userId);
    return this.employeeRepository.update(employee.id, dto);
  }

  async findDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    await this.findOne(employeeId);
    return this.employeeDocumentRepository.findByEmployeeId(employeeId);
  }

  async addDocument(employeeId: string, type: string, storedFilename: string): Promise<EmployeeDocument> {
    await this.findOne(employeeId);
    return this.employeeDocumentRepository.create({
      employeeId,
      type,
      fileUrl: storedFilename,
      uploadedAt: new Date(),
    });
  }

  async getDocumentForDownload(employeeId: string, documentId: string): Promise<EmployeeDocument> {
    const document = await this.getOwnDocumentOrThrow(employeeId, documentId);
    return document;
  }

  async removeDocument(employeeId: string, documentId: string): Promise<void> {
    const document = await this.getOwnDocumentOrThrow(employeeId, documentId);
    await this.employeeDocumentRepository.softDelete(documentId);

    // Best-effort: hapus file fisik di disk. Gagal hapus file TIDAK
    // membatalkan soft-delete baris DB — dokumen sudah dianggap terhapus
    // dari sudut pandang aplikasi meskipun file "yatim" tersisa di disk.
    unlink(join(EMPLOYEE_DOCUMENTS_UPLOAD_DIR, document.fileUrl), (error) => {
      if (error) {
        this.logger.warn(`Gagal menghapus file dokumen ${document.fileUrl}: ${error.message}`);
      }
    });
  }

  private async getOwnDocumentOrThrow(employeeId: string, documentId: string): Promise<EmployeeDocument> {
    const document = await this.employeeDocumentRepository.findById(documentId);
    if (!document || document.employeeId !== employeeId) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }
    return document;
  }
}
