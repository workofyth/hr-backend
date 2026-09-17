import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntityManager } from 'typeorm';
import { LEAVE_APPROVED_EVENT, LEAVE_CANCELLED_EVENT, LEAVE_REJECTED_EVENT, LEAVE_REPOSITORY } from './leave.constants';
import { ILeaveRepository, PaginatedResult } from './leave-repository.interface';
import { EMPLOYEE_REPOSITORY } from '../employee/employee.constants';
import { IEmployeeRepository } from '../employee/employee-repository.interface';
import { Employee } from '../employee/entities/employee.entity';
import { TRANSACTION_RUNNER, TransactionRunner } from '../../database/transaction-runner';
import { LeaveApprovalChainFactory } from './approval/leave-approval-chain.factory';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveRequest, LeaveRequestStatus } from './entities/leave-request.entity';
import { LeaveApproval, LeaveApprovalStatus } from './entities/leave-approval.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveDecisionDto } from './dto/leave-decision.dto';
import { LeaveApprovedEvent } from './events/leave-approved.event';
import { LeaveCancelledEvent } from './events/leave-cancelled.event';
import { LeaveRejectedEvent } from './events/leave-rejected.event';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../../common/enums/user-role.enum';
import { formatDateOnly } from '../../common/utils/date.util';
import { AuditLogService } from '../../common/services/audit-log.service';

/**
 * Logika bisnis modul Leave — roadmap-aplikasi-hr.md Phase 3, pattern di
 * backend-architecture-hr.md §3: validasi saldo cuti (`leave_balances`) +
 * Chain of Responsibility untuk approval berjenjang (atasan -> HR).
 * Bergantung pada interface repository (Dependency Inversion) sehingga bisa
 * di-unit-test dengan mock repository, tanpa DB/HTTP server sungguhan.
 */
@Injectable()
export class LeaveService {
  constructor(
    @Inject(LEAVE_REPOSITORY) private readonly leaveRepository: ILeaveRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: IEmployeeRepository,
    @Inject(TRANSACTION_RUNNER) private readonly transactionRunner: TransactionRunner,
    private readonly approvalChainFactory: LeaveApprovalChainFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: AuditLogService,
  ) {}

  findLeaveTypes(): Promise<LeaveType[]> {
    return this.leaveRepository.findAllLeaveTypes();
  }

  async findMyBalance(userId: string, year?: number): Promise<LeaveBalance[]> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);
    return this.leaveRepository.findBalancesByEmployee(employee.id, year ?? new Date().getUTCFullYear());
  }

  async findMyRequests(
    userId: string,
    params: { page?: number; limit?: number },
  ): Promise<PaginatedResult<LeaveRequest> & { page: number; limit: number }> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const { items, total } = await this.leaveRepository.findRequestsByEmployee(employee.id, { page, limit });
    return { items, total, page, limit };
  }

  /**
   * Antrian approval cuti (admin-dashboard-web-hr.md §5) — HR/Super Admin
   * melihat semua yang actionable, MANAGER hanya yang di-assign ke
   * dirinya (§3 Chain of Responsibility: approverId level 1 = manager).
   */
  async findPendingApprovals(actingUser: AuthenticatedUser): Promise<LeaveApproval[]> {
    const isHrOrAbove = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN].includes(actingUser.role);
    if (isHrOrAbove) {
      return this.leaveRepository.findActionableApprovals();
    }

    const actingEmployee = await this.employeeRepository.findByUserId(actingUser.userId);
    if (!actingEmployee) {
      throw new NotFoundException('Data karyawan tidak ditemukan untuk akun ini');
    }
    return this.leaveRepository.findActionableApprovals(actingEmployee.id);
  }

  /**
   * Pengajuan cuti (roadmap Phase 3). Validasi saldo hanya berlaku untuk
   * jenis cuti berbayar (`leave_types.is_paid`) — izin unpaid tidak
   * memotong kuota, sesuai catatan roadmap "potongan jika unpaid leave"
   * (dikenakan di payroll, bukan di kuota cuti).
   */
  async apply(userId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);

    const leaveType = await this.leaveRepository.findLeaveTypeById(dto.leaveTypeId);
    if (!leaveType) {
      throw new NotFoundException('Jenis cuti tidak ditemukan');
    }

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate tidak boleh sebelum startDate');
    }

    const totalDays = this.countInclusiveDays(dto.startDate, dto.endDate);

    if (leaveType.isPaid) {
      await this.assertBalanceSufficient(employee.id, leaveType.id, dto.startDate, totalDays);
    }

    const approvalLevels = await this.approvalChainFactory.buildFor(employee);
    if (approvalLevels.length === 0) {
      throw new BadRequestException('Approver cuti tidak ditemukan, hubungi HR');
    }

    return this.transactionRunner.run(async (manager) => {
      const leaveRequest = await this.leaveRepository.createRequest(
        {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          startDate: dto.startDate,
          endDate: dto.endDate,
          totalDays: totalDays.toFixed(2),
          reason: dto.reason,
          attachmentUrl: dto.attachmentUrl ?? null,
          status: LeaveRequestStatus.PENDING,
          currentApprovalLevel: approvalLevels[0].level,
        },
        manager,
      );

      for (const approvalLevel of approvalLevels) {
        await this.leaveRepository.createApproval(
          {
            leaveRequestId: leaveRequest.id,
            approverId: approvalLevel.approverId,
            level: approvalLevel.level,
            status: LeaveApprovalStatus.PENDING,
          },
          manager,
        );
      }

      return leaveRequest;
    });
  }

  async approve(actingUser: AuthenticatedUser, leaveRequestId: string, dto: LeaveDecisionDto): Promise<LeaveRequest> {
    const { leaveRequest, currentApproval, approvals, actingEmployee } = await this.loadPendingDecision(
      actingUser,
      leaveRequestId,
    );

    return this.transactionRunner.run(async (manager) => {
      await this.leaveRepository.updateApproval(
        currentApproval.id,
        {
          status: LeaveApprovalStatus.APPROVED,
          approverId: actingEmployee.id,
          comment: dto.comment ?? null,
          actedAt: new Date(),
        },
        manager,
      );

      // Checklist §7: "Ada audit log untuk perubahan data ... approval"
      // (contoh eksplisit dokumen: "siapa approve cuti").
      await this.auditLogService.record(
        {
          userId: actingUser.userId,
          action: 'APPROVE_LEAVE_REQUEST',
          entityType: 'leave_request',
          entityId: leaveRequest.id,
          oldValue: { approvalLevel: currentApproval.level, status: LeaveApprovalStatus.PENDING },
          newValue: { approvalLevel: currentApproval.level, status: LeaveApprovalStatus.APPROVED },
        },
        manager,
      );

      const nextLevel = approvals
        .filter((approval) => approval.level > currentApproval.level)
        .sort((a, b) => a.level - b.level)[0];

      if (nextLevel) {
        return this.leaveRepository.updateRequest(leaveRequest.id, { currentApprovalLevel: nextLevel.level }, manager);
      }

      await this.deductBalance(leaveRequest, manager);
      const approved = await this.leaveRepository.updateRequest(
        leaveRequest.id,
        { status: LeaveRequestStatus.APPROVED },
        manager,
      );

      this.eventEmitter.emit(
        LEAVE_APPROVED_EVENT,
        new LeaveApprovedEvent(
          leaveRequest.id,
          leaveRequest.employeeId,
          this.enumerateDates(leaveRequest.startDate, leaveRequest.endDate),
        ),
      );

      return approved;
    });
  }

  async reject(actingUser: AuthenticatedUser, leaveRequestId: string, dto: LeaveDecisionDto): Promise<LeaveRequest> {
    const { leaveRequest, currentApproval, actingEmployee } = await this.loadPendingDecision(
      actingUser,
      leaveRequestId,
    );

    return this.transactionRunner.run(async (manager) => {
      await this.leaveRepository.updateApproval(
        currentApproval.id,
        {
          status: LeaveApprovalStatus.REJECTED,
          approverId: actingEmployee.id,
          comment: dto.comment ?? null,
          actedAt: new Date(),
        },
        manager,
      );

      await this.auditLogService.record(
        {
          userId: actingUser.userId,
          action: 'REJECT_LEAVE_REQUEST',
          entityType: 'leave_request',
          entityId: leaveRequest.id,
          oldValue: { approvalLevel: currentApproval.level, status: LeaveApprovalStatus.PENDING },
          newValue: { approvalLevel: currentApproval.level, status: LeaveApprovalStatus.REJECTED },
        },
        manager,
      );

      const rejected = await this.leaveRepository.updateRequest(
        leaveRequest.id,
        { status: LeaveRequestStatus.REJECTED },
        manager,
      );

      this.eventEmitter.emit(
        LEAVE_REJECTED_EVENT,
        new LeaveRejectedEvent(
          leaveRequest.id,
          leaveRequest.employeeId,
          leaveRequest.employee.userId,
          leaveRequest.startDate,
          leaveRequest.endDate,
          dto.comment ?? null,
        ),
      );

      return rejected;
    });
  }

  async cancel(userId: string, leaveRequestId: string): Promise<LeaveRequest> {
    const employee = await this.getEmployeeByUserIdOrThrow(userId);
    const leaveRequest = await this.leaveRepository.findRequestById(leaveRequestId);
    if (!leaveRequest) {
      throw new NotFoundException('Pengajuan cuti tidak ditemukan');
    }
    if (leaveRequest.employeeId !== employee.id) {
      throw new ForbiddenException('Anda hanya bisa membatalkan pengajuan cuti sendiri');
    }
    if (![LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED].includes(leaveRequest.status)) {
      throw new ConflictException('Pengajuan cuti ini sudah tidak bisa dibatalkan');
    }
    if (leaveRequest.endDate < formatDateOnly(new Date())) {
      throw new BadRequestException('Cuti yang sudah lewat tidak bisa dibatalkan');
    }

    const wasApproved = leaveRequest.status === LeaveRequestStatus.APPROVED;

    return this.transactionRunner.run(async (manager) => {
      if (wasApproved) {
        await this.reverseBalance(leaveRequest, manager);
      }

      const cancelled = await this.leaveRepository.updateRequest(
        leaveRequest.id,
        { status: LeaveRequestStatus.CANCELLED },
        manager,
      );

      await this.auditLogService.record(
        {
          userId,
          action: 'CANCEL_LEAVE_REQUEST',
          entityType: 'leave_request',
          entityId: leaveRequest.id,
          oldValue: { status: leaveRequest.status },
          newValue: { status: LeaveRequestStatus.CANCELLED },
        },
        manager,
      );

      if (wasApproved) {
        this.eventEmitter.emit(
          LEAVE_CANCELLED_EVENT,
          new LeaveCancelledEvent(
            leaveRequest.id,
            leaveRequest.employeeId,
            this.enumerateDates(leaveRequest.startDate, leaveRequest.endDate),
          ),
        );
      }

      return cancelled;
    });
  }

  // ---------------------------------------------------------------------
  // Helper privat
  // ---------------------------------------------------------------------

  private async getEmployeeByUserIdOrThrow(userId: string): Promise<Employee> {
    const employee = await this.employeeRepository.findByUserId(userId);
    if (!employee) {
      throw new NotFoundException('Data karyawan tidak ditemukan untuk akun ini');
    }
    return employee;
  }

  private async assertBalanceSufficient(
    employeeId: string,
    leaveTypeId: string,
    startDate: string,
    totalDays: number,
  ): Promise<void> {
    const year = Number(startDate.slice(0, 4));
    const balance = await this.leaveRepository.findBalance(employeeId, leaveTypeId, year);
    if (!balance) {
      throw new NotFoundException('Saldo cuti tidak ditemukan untuk jenis cuti ini, hubungi HR');
    }

    const availableDays = Number(balance.entitledDays) + Number(balance.carriedOverDays) - Number(balance.usedDays);
    if (totalDays > availableDays) {
      throw new BadRequestException({
        errorCode: 'LEAVE_INSUFFICIENT_BALANCE',
        message: 'Saldo cuti tidak cukup',
        details: { requestedDays: totalDays, availableDays },
      });
    }
  }

  private async deductBalance(leaveRequest: LeaveRequest, manager: EntityManager): Promise<void> {
    await this.adjustBalance(leaveRequest, manager, (usedDays, totalDays) => usedDays + totalDays);
  }

  private async reverseBalance(leaveRequest: LeaveRequest, manager: EntityManager): Promise<void> {
    await this.adjustBalance(leaveRequest, manager, (usedDays, totalDays) => Math.max(0, usedDays - totalDays));
  }

  private async adjustBalance(
    leaveRequest: LeaveRequest,
    manager: EntityManager,
    adjust: (usedDays: number, totalDays: number) => number,
  ): Promise<void> {
    const leaveType =
      leaveRequest.leaveType ?? (await this.leaveRepository.findLeaveTypeById(leaveRequest.leaveTypeId));
    if (!leaveType?.isPaid) {
      return;
    }

    const year = Number(leaveRequest.startDate.slice(0, 4));
    const balance = await this.leaveRepository.findBalance(leaveRequest.employeeId, leaveRequest.leaveTypeId, year);
    if (!balance) {
      return;
    }

    const usedDays = adjust(Number(balance.usedDays), Number(leaveRequest.totalDays));
    await this.leaveRepository.updateBalance(balance.id, { usedDays: usedDays.toFixed(2) }, manager);
  }

  private async loadPendingDecision(
    actingUser: AuthenticatedUser,
    leaveRequestId: string,
  ): Promise<{
    leaveRequest: LeaveRequest;
    currentApproval: LeaveApproval;
    approvals: LeaveApproval[];
    actingEmployee: Employee;
  }> {
    const leaveRequest = await this.leaveRepository.findRequestById(leaveRequestId);
    if (!leaveRequest) {
      throw new NotFoundException('Pengajuan cuti tidak ditemukan');
    }
    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException('Pengajuan cuti ini sudah diproses');
    }

    const approvals = await this.leaveRepository.findApprovalsByRequestId(leaveRequest.id);
    const currentApproval = approvals.find((approval) => approval.level === leaveRequest.currentApprovalLevel);
    if (!currentApproval || currentApproval.status !== LeaveApprovalStatus.PENDING) {
      throw new ConflictException('Level approval saat ini tidak valid');
    }

    const actingEmployee = await this.employeeRepository.findByUserId(actingUser.userId);
    if (!actingEmployee) {
      throw new NotFoundException('Data karyawan approver tidak ditemukan');
    }

    const isHrOrAbove = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN].includes(actingUser.role);
    const isAssignedApprover = currentApproval.approverId === actingEmployee.id;
    if (!isAssignedApprover && !isHrOrAbove) {
      throw new ForbiddenException('Anda bukan approver untuk level ini');
    }

    return { leaveRequest, currentApproval, approvals, actingEmployee };
  }

  private countInclusiveDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  private enumerateDates(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= end) {
      dates.push(formatDateOnly(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }
}
