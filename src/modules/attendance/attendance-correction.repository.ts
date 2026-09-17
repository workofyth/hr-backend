import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { AttendanceCorrection } from './entities/attendance-correction.entity';
import { IAttendanceCorrectionRepository } from './attendance-correction-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel `attendance_corrections` (§5.3).
 */
@Injectable()
export class AttendanceCorrectionRepository implements IAttendanceCorrectionRepository {
  constructor(
    @InjectRepository(AttendanceCorrection)
    private readonly repository: Repository<AttendanceCorrection>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<AttendanceCorrection> {
    return manager ? manager.getRepository(AttendanceCorrection) : this.repository;
  }

  findById(id: string): Promise<AttendanceCorrection | null> {
    return this.repository.findOne({ where: { id } });
  }

  create(data: DeepPartial<AttendanceCorrection>): Promise<AttendanceCorrection> {
    const correction = this.repository.create(data);
    return this.repository.save(correction);
  }

  async update(
    id: string,
    data: DeepPartial<AttendanceCorrection>,
    manager?: EntityManager,
  ): Promise<AttendanceCorrection> {
    const repository = this.getRepository(manager);
    await repository.update(id, data);
    return repository.findOneOrFail({ where: { id } });
  }
}
