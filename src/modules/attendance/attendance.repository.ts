import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DeepPartial, EntityManager, Repository } from 'typeorm';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { EmployeeShiftAssignment } from '../employee/entities/employee-shift-assignment.entity';
import {
  AttendanceStatusCounts,
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

  async countStatusesByEmployee(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceStatusCounts> {
    const rows = await this.repository
      .createQueryBuilder('attendance')
      .select('attendance.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(attendance.work_duration_minutes), 0)', 'totalMinutes')
      .where('attendance.employee_id = :employeeId', { employeeId })
      .andWhere('attendance.attendance_date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('attendance.status')
      .getRawMany<{ status: AttendanceStatus; count: string; totalMinutes: string }>();

    const counts: AttendanceStatusCounts = {
      [AttendanceStatus.ON_TIME]: 0,
      [AttendanceStatus.LATE]: 0,
      [AttendanceStatus.EARLY_LEAVE]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.ON_LEAVE]: 0,
      [AttendanceStatus.WFH]: 0,
      totalWorkDurationMinutes: 0,
    };

    for (const row of rows) {
      counts[row.status] = Number(row.count);
      counts.totalWorkDurationMinutes += Number(row.totalMinutes);
    }

    return counts;
  }

  findShiftAssignmentsByEmployee(employeeId: string): Promise<EmployeeShiftAssignment[]> {
    return this.shiftAssignmentRepository.find({
      where: { employeeId },
      relations: ['shift'],
      order: { effectiveDate: 'DESC' },
    });
  }

  findOpenShiftAssignment(employeeId: string): Promise<EmployeeShiftAssignment | null> {
    return this.shiftAssignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.employee_id = :employeeId', { employeeId })
      .andWhere('assignment.end_date IS NULL')
      .getOne();
  }

  createShiftAssignment(
    data: DeepPartial<EmployeeShiftAssignment>,
    manager?: EntityManager,
  ): Promise<EmployeeShiftAssignment> {
    const repository = manager ? manager.getRepository(EmployeeShiftAssignment) : this.shiftAssignmentRepository;
    const assignment = repository.create(data);
    return repository.save(assignment);
  }

  async closeShiftAssignment(id: string, endDate: string, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(EmployeeShiftAssignment) : this.shiftAssignmentRepository;
    await repository.update(id, { endDate });
  }
}
