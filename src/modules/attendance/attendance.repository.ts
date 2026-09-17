import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DeepPartial, EntityManager, Repository } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import { EmployeeShiftAssignment } from '../employee/entities/employee-shift-assignment.entity';
import {
  FindHistoryParams,
  IAttendanceRepository,
  PaginatedResult,
} from './attendance-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel `attendances` (§5.3).
 * Satu-satunya tempat yang boleh query langsung ke tabel `attendances`
 * (dan, untuk keperluan baca acuan jam kerja, `employee_shift_assignments`).
 */
@Injectable()
export class AttendanceRepository implements IAttendanceRepository {
  constructor(
    @InjectRepository(Attendance) private readonly repository: Repository<Attendance>,
    @InjectRepository(EmployeeShiftAssignment)
    private readonly shiftAssignmentRepository: Repository<EmployeeShiftAssignment>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<Attendance> {
    return manager ? manager.getRepository(Attendance) : this.repository;
  }

  findByEmployeeAndDate(employeeId: string, attendanceDate: string): Promise<Attendance | null> {
    return this.repository.findOne({ where: { employeeId, attendanceDate }, relations: ['shift'] });
  }

  findById(id: string): Promise<Attendance | null> {
    return this.repository.findOne({ where: { id }, relations: ['branch', 'shift'] });
  }

  async findHistory({
    employeeId,
    page,
    limit,
    month,
    year,
  }: FindHistoryParams): Promise<PaginatedResult<Attendance>> {
    const where: Record<string, unknown> = { employeeId };

    if (month && year) {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      where.attendanceDate = Between(from, to);
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      relations: ['branch', 'shift'],
      order: { attendanceDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  create(data: DeepPartial<Attendance>, manager?: EntityManager): Promise<Attendance> {
    const repository = this.getRepository(manager);
    const attendance = repository.create(data);
    return repository.save(attendance);
  }

  async update(
    id: string,
    data: DeepPartial<Attendance>,
    manager?: EntityManager,
  ): Promise<Attendance> {
    const repository = this.getRepository(manager);
    await repository.update(id, data);
    return repository.findOneOrFail({ where: { id } });
  }

  findActiveShiftAssignment(
    employeeId: string,
    date: string,
  ): Promise<EmployeeShiftAssignment | null> {
    return this.shiftAssignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.shift', 'shift')
      .where('assignment.employee_id = :employeeId', { employeeId })
      .andWhere('assignment.effective_date <= :date', { date })
      .andWhere('(assignment.end_date IS NULL OR assignment.end_date >= :date)', { date })
      .orderBy('assignment.effective_date', 'DESC')
      .getOne();
  }
}
