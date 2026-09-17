import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveService } from './leave.service';
import { ILeaveRepository } from './leave-repository.interface';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { TransactionRunner } from '../../database/transaction-runner';
import { LeaveApprovalChainFactory } from './approval/leave-approval-chain.factory';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveRequest, LeaveRequestStatus } from './entities/leave-request.entity';
import { LeaveApproval, LeaveApprovalStatus } from './entities/leave-approval.entity';
import { Employee } from '../employee/entities/employee.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { LEAVE_APPROVED_EVENT, LEAVE_CANCELLED_EVENT } from './leave.constants';

describe('LeaveService', () => {
  let service: LeaveService;
  let leaveRepository: jest.Mocked<ILeaveRepository>;
  let employeeRepository: jest.Mocked<IEmployeeRepository>;
  let transactionRunner: TransactionRunner;
  let approvalChainFactory: jest.Mocked<LeaveApprovalChainFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const employee = {
    id: 'employee-1',
    userId: 'user-1',
    companyId: 'company-1',
    managerId: 'manager-employee-1',
  } as unknown as Employee;

  const paidLeaveType = { id: 'leave-type-1', isPaid: true } as LeaveType;

  beforeEach(() => {
    leaveRepository = {
      findLeaveTypeById: jest.fn(),
      findAllLeaveTypes: jest.fn(),
      findBalance: jest.fn(),
      findBalancesByEmployee: jest.fn(),
      updateBalance: jest.fn(),
      findRequestById: jest.fn(),
      findRequestsByEmployee: jest.fn(),
      findApprovedRequestsOverlapping: jest.fn(),
      createRequest: jest.fn(),
      updateRequest: jest.fn(),
      findApprovalsByRequestId: jest.fn(),
      createApproval: jest.fn(),
      updateApproval: jest.fn(),
    };

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

    const runMock = jest.fn((work: (manager: never) => Promise<unknown>) => work(undefined as never));
    transactionRunner = { run: runMock } as unknown as TransactionRunner;

    approvalChainFactory = { buildFor: jest.fn() } as unknown as jest.Mocked<LeaveApprovalChainFactory>;
    eventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;

    service = new LeaveService(
      leaveRepository,
      employeeRepository,
      transactionRunner,
      approvalChainFactory,
      eventEmitter,
    );

    employeeRepository.findByUserId.mockResolvedValue(employee);
  });

  describe('apply', () => {
    it('menolak dengan BadRequestException (LEAVE_INSUFFICIENT_BALANCE) saat saldo cuti tidak cukup', async () => {
      leaveRepository.findLeaveTypeById.mockResolvedValue(paidLeaveType);
      leaveRepository.findBalance.mockResolvedValue({
        entitledDays: '12.00',
        usedDays: '10.00',
        carriedOverDays: '0.00',
      } as LeaveBalance);

      await expect(
        service.apply('user-1', {
          leaveTypeId: 'leave-type-1',
          startDate: '2026-03-10',
          endDate: '2026-03-12', // 3 hari, saldo tersisa cuma 2
          reason: 'Liburan keluarga',
        }),
      ).rejects.toMatchObject({
        response: { errorCode: 'LEAVE_INSUFFICIENT_BALANCE' },
      });

      expect(leaveRepository.createRequest).not.toHaveBeenCalled();
      expect(approvalChainFactory.buildFor).not.toHaveBeenCalled();
    });

    it('menolak dengan NotFoundException jika saldo cuti belum pernah dibuat untuk jenis cuti ini', async () => {
      leaveRepository.findLeaveTypeById.mockResolvedValue(paidLeaveType);
      leaveRepository.findBalance.mockResolvedValue(null);

      await expect(
        service.apply('user-1', {
          leaveTypeId: 'leave-type-1',
          startDate: '2026-03-10',
          endDate: '2026-03-10',
          reason: 'Sakit',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('tidak memvalidasi saldo untuk jenis cuti unpaid', async () => {
      leaveRepository.findLeaveTypeById.mockResolvedValue({ id: 'leave-type-2', isPaid: false } as LeaveType);
      approvalChainFactory.buildFor.mockResolvedValue([{ level: 1, approverId: 'manager-employee-1' }]);
      leaveRepository.createRequest.mockResolvedValue({ id: 'req-1' } as LeaveRequest);
      leaveRepository.createApproval.mockResolvedValue({} as LeaveApproval);

      await service.apply('user-1', {
        leaveTypeId: 'leave-type-2',
        startDate: '2026-03-10',
        endDate: '2026-03-10',
        reason: 'Izin pribadi',
      });

      expect(leaveRepository.findBalance).not.toHaveBeenCalled();
      expect(leaveRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: LeaveRequestStatus.PENDING, currentApprovalLevel: 1 }),
        undefined,
      );
    });

    it('membuat baris leave_approvals untuk setiap level hasil Chain of Responsibility (manager + HR)', async () => {
      leaveRepository.findLeaveTypeById.mockResolvedValue(paidLeaveType);
      leaveRepository.findBalance.mockResolvedValue({
        entitledDays: '12.00',
        usedDays: '0.00',
        carriedOverDays: '0.00',
      } as LeaveBalance);
      approvalChainFactory.buildFor.mockResolvedValue([
        { level: 1, approverId: 'manager-employee-1' },
        { level: 2, approverId: 'hr-employee-1' },
      ]);
      leaveRepository.createRequest.mockResolvedValue({ id: 'req-1' } as LeaveRequest);
      leaveRepository.createApproval.mockResolvedValue({} as LeaveApproval);

      await service.apply('user-1', {
        leaveTypeId: 'leave-type-1',
        startDate: '2026-03-10',
        endDate: '2026-03-11',
        reason: 'Cuti tahunan',
      });

      expect(leaveRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ totalDays: '2.00', currentApprovalLevel: 1 }),
        undefined,
      );
      expect(leaveRepository.createApproval).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ level: 1, approverId: 'manager-employee-1' }),
        undefined,
      );
      expect(leaveRepository.createApproval).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ level: 2, approverId: 'hr-employee-1' }),
        undefined,
      );
    });

    it('menolak dengan BadRequestException jika tidak ada approver sama sekali (tanpa manager & HR)', async () => {
      leaveRepository.findLeaveTypeById.mockResolvedValue(paidLeaveType);
      leaveRepository.findBalance.mockResolvedValue({
        entitledDays: '12.00',
        usedDays: '0.00',
        carriedOverDays: '0.00',
      } as LeaveBalance);
      approvalChainFactory.buildFor.mockResolvedValue([]);

      await expect(
        service.apply('user-1', {
          leaveTypeId: 'leave-type-1',
          startDate: '2026-03-10',
          endDate: '2026-03-10',
          reason: 'Cuti tahunan',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(leaveRepository.createRequest).not.toHaveBeenCalled();
    });
  });

  describe('approve — approval berjenjang (manager -> HR)', () => {
    const managerApproval = {
      id: 'approval-1',
      leaveRequestId: 'req-1',
      approverId: 'manager-employee-1',
      level: 1,
      status: LeaveApprovalStatus.PENDING,
    } as LeaveApproval;
    const hrApproval = {
      id: 'approval-2',
      leaveRequestId: 'req-1',
      approverId: 'hr-employee-1',
      level: 2,
      status: LeaveApprovalStatus.PENDING,
    } as LeaveApproval;

    const pendingRequest = {
      id: 'req-1',
      employeeId: 'employee-1',
      leaveTypeId: 'leave-type-1',
      leaveType: paidLeaveType,
      startDate: '2026-03-10',
      endDate: '2026-03-11',
      totalDays: '2.00',
      status: LeaveRequestStatus.PENDING,
      currentApprovalLevel: 1,
    } as unknown as LeaveRequest;

    it('approval level manager (level 1) hanya memindahkan ke level HR, TIDAK memotong saldo/emit event', async () => {
      leaveRepository.findRequestById.mockResolvedValue(pendingRequest);
      leaveRepository.findApprovalsByRequestId.mockResolvedValue([managerApproval, hrApproval]);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'manager-employee-1' } as Employee);
      leaveRepository.updateRequest.mockResolvedValue({
        ...pendingRequest,
        currentApprovalLevel: 2,
      } as LeaveRequest);

      const managerActingUser = { userId: 'manager-user-1', role: UserRole.MANAGER };
      const result = await service.approve(managerActingUser, 'req-1', {});

      expect(leaveRepository.updateApproval).toHaveBeenCalledWith(
        'approval-1',
        expect.objectContaining({ status: LeaveApprovalStatus.APPROVED, approverId: 'manager-employee-1' }),
        undefined,
      );
      expect(leaveRepository.updateRequest).toHaveBeenCalledWith(
        'req-1',
        { currentApprovalLevel: 2 },
        undefined,
      );
      expect(leaveRepository.findBalance).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result.currentApprovalLevel).toBe(2);
    });

    it('approval level HR (level terakhir) memotong leave_balances.used_days & emit leave.approved', async () => {
      const requestAtHrLevel = { ...pendingRequest, currentApprovalLevel: 2 } as unknown as LeaveRequest;
      leaveRepository.findRequestById.mockResolvedValue(requestAtHrLevel);
      leaveRepository.findApprovalsByRequestId.mockResolvedValue([
        { ...managerApproval, status: LeaveApprovalStatus.APPROVED },
        hrApproval,
      ]);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'hr-employee-1' } as Employee);
      leaveRepository.findBalance.mockResolvedValue({
        id: 'balance-1',
        usedDays: '0.00',
      } as LeaveBalance);
      leaveRepository.updateRequest.mockResolvedValue({
        ...requestAtHrLevel,
        status: LeaveRequestStatus.APPROVED,
      } as LeaveRequest);

      const hrActingUser = { userId: 'hr-user-1', role: UserRole.HR_ADMIN };
      const result = await service.approve(hrActingUser, 'req-1', { comment: 'Disetujui' });

      expect(leaveRepository.updateApproval).toHaveBeenCalledWith(
        'approval-2',
        expect.objectContaining({ status: LeaveApprovalStatus.APPROVED, approverId: 'hr-employee-1' }),
        undefined,
      );
      expect(leaveRepository.updateBalance).toHaveBeenCalledWith(
        'balance-1',
        { usedDays: '2.00' },
        undefined,
      );
      expect(leaveRepository.updateRequest).toHaveBeenCalledWith(
        'req-1',
        { status: LeaveRequestStatus.APPROVED },
        undefined,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        LEAVE_APPROVED_EVENT,
        expect.objectContaining({
          leaveRequestId: 'req-1',
          employeeId: 'employee-1',
          dates: ['2026-03-10', '2026-03-11'],
        }),
      );
      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
    });

    it('menolak dengan ForbiddenException jika bukan approver level ini & bukan HR/Super Admin', async () => {
      leaveRepository.findRequestById.mockResolvedValue(pendingRequest);
      leaveRepository.findApprovalsByRequestId.mockResolvedValue([managerApproval, hrApproval]);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'other-employee' } as Employee);

      const otherActingUser = { userId: 'other-user-1', role: UserRole.MANAGER };

      await expect(service.approve(otherActingUser, 'req-1', {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(leaveRepository.updateApproval).not.toHaveBeenCalled();
    });

    it('menolak dengan ConflictException jika pengajuan sudah diproses sebelumnya', async () => {
      leaveRepository.findRequestById.mockResolvedValue({
        ...pendingRequest,
        status: LeaveRequestStatus.APPROVED,
      } as LeaveRequest);

      await expect(
        service.approve({ userId: 'manager-user-1', role: UserRole.MANAGER }, 'req-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reject', () => {
    it('menolak pengajuan pada level saat ini tanpa menyentuh saldo', async () => {
      const pendingRequest = {
        id: 'req-1',
        employeeId: 'employee-1',
        leaveTypeId: 'leave-type-1',
        leaveType: paidLeaveType,
        startDate: '2026-03-10',
        endDate: '2026-03-10',
        totalDays: '1.00',
        status: LeaveRequestStatus.PENDING,
        currentApprovalLevel: 1,
      } as unknown as LeaveRequest;
      const managerApproval = {
        id: 'approval-1',
        approverId: 'manager-employee-1',
        level: 1,
        status: LeaveApprovalStatus.PENDING,
      } as LeaveApproval;

      leaveRepository.findRequestById.mockResolvedValue(pendingRequest);
      leaveRepository.findApprovalsByRequestId.mockResolvedValue([managerApproval]);
      employeeRepository.findByUserId.mockResolvedValue({ id: 'manager-employee-1' } as Employee);
      leaveRepository.updateRequest.mockResolvedValue({
        ...pendingRequest,
        status: LeaveRequestStatus.REJECTED,
      } as LeaveRequest);

      const result = await service.reject({ userId: 'manager-user-1', role: UserRole.MANAGER }, 'req-1', {
        comment: 'Bertepatan dengan periode tutup buku',
      });

      expect(leaveRepository.updateApproval).toHaveBeenCalledWith(
        'approval-1',
        expect.objectContaining({ status: LeaveApprovalStatus.REJECTED }),
        undefined,
      );
      expect(leaveRepository.updateBalance).not.toHaveBeenCalled();
      expect(result.status).toBe(LeaveRequestStatus.REJECTED);
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('membatalkan pengajuan PENDING tanpa mengembalikan saldo', async () => {
      const pendingRequest = {
        id: 'req-1',
        employeeId: 'employee-1',
        leaveTypeId: 'leave-type-1',
        leaveType: paidLeaveType,
        startDate: '2026-03-10',
        endDate: '2026-03-10',
        totalDays: '1.00',
        status: LeaveRequestStatus.PENDING,
      } as unknown as LeaveRequest;

      leaveRepository.findRequestById.mockResolvedValue(pendingRequest);
      leaveRepository.updateRequest.mockResolvedValue({
        ...pendingRequest,
        status: LeaveRequestStatus.CANCELLED,
      } as LeaveRequest);

      const result = await service.cancel('user-1', 'req-1');

      expect(leaveRepository.updateBalance).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result.status).toBe(LeaveRequestStatus.CANCELLED);
    });

    it('membatalkan pengajuan APPROVED: mengembalikan leave_balances.used_days & emit leave.cancelled', async () => {
      const approvedRequest = {
        id: 'req-1',
        employeeId: 'employee-1',
        leaveTypeId: 'leave-type-1',
        leaveType: paidLeaveType,
        startDate: '2026-03-10',
        endDate: '2026-03-11',
        totalDays: '2.00',
        status: LeaveRequestStatus.APPROVED,
      } as unknown as LeaveRequest;

      leaveRepository.findRequestById.mockResolvedValue(approvedRequest);
      leaveRepository.findBalance.mockResolvedValue({ id: 'balance-1', usedDays: '5.00' } as LeaveBalance);
      leaveRepository.updateRequest.mockResolvedValue({
        ...approvedRequest,
        status: LeaveRequestStatus.CANCELLED,
      } as LeaveRequest);

      await service.cancel('user-1', 'req-1');

      expect(leaveRepository.updateBalance).toHaveBeenCalledWith('balance-1', { usedDays: '3.00' }, undefined);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        LEAVE_CANCELLED_EVENT,
        expect.objectContaining({ employeeId: 'employee-1', dates: ['2026-03-10', '2026-03-11'] }),
      );
    });

    it('menolak dengan ForbiddenException jika membatalkan pengajuan milik karyawan lain', async () => {
      leaveRepository.findRequestById.mockResolvedValue({
        id: 'req-1',
        employeeId: 'other-employee',
        status: LeaveRequestStatus.PENDING,
        endDate: '2026-03-10',
      } as unknown as LeaveRequest);

      await expect(service.cancel('user-1', 'req-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('menolak dengan ConflictException jika pengajuan sudah REJECTED/CANCELLED', async () => {
      leaveRepository.findRequestById.mockResolvedValue({
        id: 'req-1',
        employeeId: 'employee-1',
        status: LeaveRequestStatus.REJECTED,
        endDate: '2026-03-10',
      } as unknown as LeaveRequest);

      await expect(service.cancel('user-1', 'req-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
