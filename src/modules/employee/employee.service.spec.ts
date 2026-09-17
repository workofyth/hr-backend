import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { EmployeeService } from './employee.service';
import { IEmployeeRepository } from './employee-repository.interface';
import { IUserRepository } from '../auth/user-repository.interface';
import { TransactionRunner } from '../../database/transaction-runner';
import { Employee, EmployeeStatus, EmploymentType, MaritalStatus } from './entities/employee.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import * as passwordUtil from '../../common/utils/password.util';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let employeeRepository: jest.Mocked<IEmployeeRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let transactionRunner: TransactionRunner;
  let runMock: jest.Mock;

  const fakeUser = { id: 'user-1' } as User;
  const fakeEmployee = { id: 'employee-1', employeeCode: 'EMP-001' } as Employee;

  const createDto: CreateEmployeeDto = {
    email: 'karyawan@perusahaan.co.id',
    phone: '081234567890',
    password: 'password123',
    employeeCode: 'EMP-001',
    fullName: 'Budi Santoso',
    companyId: 'company-1',
    branchId: 'branch-1',
    departmentId: 'department-1',
    positionId: 'position-1',
    nik: '3171012345670001',
    bankAccountNo: '1234567890',
    bankName: 'BCA',
    employmentType: EmploymentType.PKWTT,
    joinDate: '2026-01-01',
    maritalStatus: MaritalStatus.TK,
  };

  beforeEach(() => {
    employeeRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByEmployeeCode: jest.fn(),
      findFirstByCompanyAndRole: jest.fn(),
      findActiveByCompany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    userRepository = {
      findById: jest.fn(),
      findByEmailOrPhone: jest.fn(),
      create: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    // Jalankan callback transaksi langsung tanpa DB/manager sungguhan —
    // repository sudah di-mock sehingga argumen `manager` diabaikan.
    runMock = jest.fn((work: (manager: never) => Promise<unknown>) => work(undefined as never));
    transactionRunner = { run: runMock } as unknown as TransactionRunner;

    jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('hashed-password');

    service = new EmployeeService(employeeRepository, userRepository, transactionRunner);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('membuat user (role EMPLOYEE default) lalu employee dalam satu transaksi', async () => {
      employeeRepository.findByEmployeeCode.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(fakeUser);
      employeeRepository.create.mockResolvedValue(fakeEmployee);

      const result = await service.create(createDto);

      expect(result).toBe(fakeEmployee);
      expect(runMock).toHaveBeenCalledTimes(1);
      expect(passwordUtil.hashPassword).toHaveBeenCalledWith('password123');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createDto.email,
          phone: createDto.phone,
          passwordHash: 'hashed-password',
          role: UserRole.EMPLOYEE,
        }),
        undefined,
      );
      expect(employeeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: fakeUser.id,
          employeeCode: createDto.employeeCode,
          status: EmployeeStatus.ACTIVE,
        }),
        undefined,
      );
    });

    it('menolak dengan ConflictException jika employeeCode sudah dipakai', async () => {
      employeeRepository.findByEmployeeCode.mockResolvedValue(fakeEmployee);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(ConflictException);
      expect(runMock).not.toHaveBeenCalled();
    });

    it('menerjemahkan unique violation Postgres (23505) menjadi ConflictException', async () => {
      employeeRepository.findByEmployeeCode.mockResolvedValue(null);
      const dbError = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (dbError as unknown as { code: string }).code = '23505';
      runMock.mockRejectedValueOnce(dbError);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne', () => {
    it('mengembalikan employee jika ditemukan', async () => {
      employeeRepository.findById.mockResolvedValue(fakeEmployee);

      await expect(service.findOne('employee-1')).resolves.toBe(fakeEmployee);
    });

    it('melempar NotFoundException jika tidak ditemukan', async () => {
      employeeRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('unknown-id')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('memvalidasi keberadaan employee sebelum update', async () => {
      employeeRepository.findById.mockResolvedValue(fakeEmployee);
      employeeRepository.update.mockResolvedValue({ ...fakeEmployee, fullName: 'Nama Baru' } as Employee);

      const result = await service.update('employee-1', { fullName: 'Nama Baru' });

      expect(employeeRepository.update).toHaveBeenCalledWith('employee-1', { fullName: 'Nama Baru' });
      expect(result.fullName).toBe('Nama Baru');
    });

    it('melempar NotFoundException tanpa memanggil update jika employee tidak ada', async () => {
      employeeRepository.findById.mockResolvedValue(null);

      await expect(service.update('unknown-id', { fullName: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(employeeRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('melakukan soft delete setelah memastikan employee ada', async () => {
      employeeRepository.findById.mockResolvedValue(fakeEmployee);

      await service.remove('employee-1');

      expect(employeeRepository.softDelete).toHaveBeenCalledWith('employee-1');
    });

    it('melempar NotFoundException tanpa memanggil softDelete jika employee tidak ada', async () => {
      employeeRepository.findById.mockResolvedValue(null);

      await expect(service.remove('unknown-id')).rejects.toBeInstanceOf(NotFoundException);
      expect(employeeRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('findMe', () => {
    it('mengambil data employee milik userId yang sedang login', async () => {
      employeeRepository.findByUserId.mockResolvedValue(fakeEmployee);

      const result = await service.findMe('user-1');

      expect(employeeRepository.findByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(fakeEmployee);
    });

    it('melempar NotFoundException jika akun ini tidak punya data employee', async () => {
      employeeRepository.findByUserId.mockResolvedValue(null);

      await expect(service.findMe('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('hanya mengizinkan update field self-service (bankAccountNo/bankName) pada employee milik userId sendiri', async () => {
      employeeRepository.findByUserId.mockResolvedValue(fakeEmployee);
      employeeRepository.update.mockResolvedValue({ ...fakeEmployee, bankAccountNo: '999' } as Employee);

      await service.updateMe('user-1', { bankAccountNo: '999', bankName: 'Mandiri' });

      expect(employeeRepository.update).toHaveBeenCalledWith('employee-1', {
        bankAccountNo: '999',
        bankName: 'Mandiri',
      });
    });

    it('melempar NotFoundException tanpa memanggil update jika akun ini tidak punya data employee', async () => {
      employeeRepository.findByUserId.mockResolvedValue(null);

      await expect(service.updateMe('user-1', { bankName: 'Mandiri' })).rejects.toBeInstanceOf(NotFoundException);
      expect(employeeRepository.update).not.toHaveBeenCalled();
    });
  });
});
