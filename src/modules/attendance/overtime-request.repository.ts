import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DeepPartial, EntityManager, Repository } from 'typeorm';
import { OvertimeRequest, OvertimeRequestStatus } from './entities/overtime-request.entity';
import { IOvertimeRequestRepository } from './overtime-request-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel `overtime_requests` (§5.3).
 */
@Injectable()
export class OvertimeRequestRepository implements IOvertimeRequestRepository {
  constructor(
    @InjectRepository(OvertimeRequest)
    private readonly repository: Repository<OvertimeRequest>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<OvertimeRequest> {
    return manager ? manager.getRepository(OvertimeRequest) : this.repository;
  }

  findById(id: string): Promise<OvertimeRequest | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByStatus(status: OvertimeRequestStatus): Promise<OvertimeRequest[]> {
    return this.repository.find({
      where: { status },
      relations: ['employee'],
      order: { createdAt: 'ASC' },
    });
  }

  findApprovedByEmployeeAndDateRange(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<OvertimeRequest[]> {
    return this.repository.find({
      where: {
        employeeId,
        status: OvertimeRequestStatus.APPROVED,
        date: Between(startDate, endDate),
      },
    });
  }

  create(data: DeepPartial<OvertimeRequest>): Promise<OvertimeRequest> {
    const request = this.repository.create(data);
    return this.repository.save(request);
  }

  async update(id: string, data: DeepPartial<OvertimeRequest>, manager?: EntityManager): Promise<OvertimeRequest> {
    const repository = this.getRepository(manager);
    await repository.update(id, data);
    return repository.findOneOrFail({ where: { id } });
  }
}
