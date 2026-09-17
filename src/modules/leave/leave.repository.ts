import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveRequest, LeaveRequestStatus } from './entities/leave-request.entity';
import { LeaveApproval } from './entities/leave-approval.entity';
import {
  ILeaveRepository,
  PaginatedResult,
  PaginationParams,
} from './leave-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel-tabel §5.4 (leave_types,
 * leave_balances, leave_requests, leave_approvals). Satu-satunya tempat
 * yang boleh query langsung ke tabel-tabel tersebut.
 */
@Injectable()
export class LeaveRepository implements ILeaveRepository {
  constructor(
    @InjectRepository(LeaveType) private readonly leaveTypeRepository: Repository<LeaveType>,
    @InjectRepository(LeaveBalance) private readonly leaveBalanceRepository: Repository<LeaveBalance>,
    @InjectRepository(LeaveRequest) private readonly leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(LeaveApproval) private readonly leaveApprovalRepository: Repository<LeaveApproval>,
  ) {}

  findLeaveTypeById(id: string): Promise<LeaveType | null> {
    return this.leaveTypeRepository.findOne({ where: { id } });
  }

  findAllLeaveTypes(companyId?: string): Promise<LeaveType[]> {
    return this.leaveTypeRepository.find({
      where: companyId ? { companyId } : {},
      order: { name: 'ASC' },
    });
  }

  findBalance(employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalance | null> {
    return this.leaveBalanceRepository.findOne({ where: { employeeId, leaveTypeId, year } });
  }

  findBalancesByEmployee(employeeId: string, year: number): Promise<LeaveBalance[]> {
    return this.leaveBalanceRepository.find({
      where: { employeeId, year },
      relations: ['leaveType'],
      order: { leaveType: { name: 'ASC' } },
    });
  }

  async updateBalance(
    id: string,
    data: DeepPartial<LeaveBalance>,
    manager?: EntityManager,
  ): Promise<LeaveBalance> {
    const repository = manager ? manager.getRepository(LeaveBalance) : this.leaveBalanceRepository;
    await repository.update(id, data);
    return repository.findOneOrFail({ where: { id } });
  }

  findRequestById(id: string): Promise<LeaveRequest | null> {
    return this.leaveRequestRepository.findOne({ where: { id }, relations: ['employee', 'leaveType'] });
  }

  async findRequestsByEmployee(
    employeeId: string,
    { page, limit }: PaginationParams,
  ): Promise<PaginatedResult<LeaveRequest>> {
    const [items, total] = await this.leaveRequestRepository.findAndCount({
      where: { employeeId },
      relations: ['leaveType'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  findApprovedRequestsOverlapping(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<LeaveRequest[]> {
    return this.leaveRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.leaveType', 'leaveType')
      .where('request.employee_id = :employeeId', { employeeId })
      .andWhere('request.status = :status', { status: LeaveRequestStatus.APPROVED })
      .andWhere('request.start_date <= :endDate', { endDate })
      .andWhere('request.end_date >= :startDate', { startDate })
      .getMany();
  }

  createRequest(data: DeepPartial<LeaveRequest>, manager?: EntityManager): Promise<LeaveRequest> {
    const repository = manager ? manager.getRepository(LeaveRequest) : this.leaveRequestRepository;
    const leaveRequest = repository.create(data);
    return repository.save(leaveRequest);
  }

  async updateRequest(
    id: string,
    data: DeepPartial<LeaveRequest>,
    manager?: EntityManager,
  ): Promise<LeaveRequest> {
    const repository = manager ? manager.getRepository(LeaveRequest) : this.leaveRequestRepository;
    await repository.update(id, data);
    return repository.findOneOrFail({ where: { id } });
  }

  findApprovalsByRequestId(requestId: string): Promise<LeaveApproval[]> {
    return this.leaveApprovalRepository.find({ where: { leaveRequestId: requestId }, order: { level: 'ASC' } });
  }

  createApproval(data: DeepPartial<LeaveApproval>, manager?: EntityManager): Promise<LeaveApproval> {
    const repository = manager ? manager.getRepository(LeaveApproval) : this.leaveApprovalRepository;
    const approval = repository.create(data);
    return repository.save(approval);
  }

  async updateApproval(
    id: string,
    data: DeepPartial<LeaveApproval>,
    manager?: EntityManager,
  ): Promise<LeaveApproval> {
    const repository = manager ? manager.getRepository(LeaveApproval) : this.leaveApprovalRepository;
    await repository.update(id, data);
    return repository.findOneOrFail({ where: { id } });
  }

  countByEmployeeAndStatus(employeeId: string, status: LeaveRequestStatus): Promise<number> {
    return this.leaveRequestRepository.count({ where: { employeeId, status } });
  }
}
