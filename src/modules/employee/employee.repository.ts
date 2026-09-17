import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { Employee, EmployeeStatus } from './entities/employee.entity';
import {
  IEmployeeRepository,
  PaginatedResult,
  PaginationParams,
} from './employee-repository.interface';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * Implementasi Repository Pattern untuk tabel `employees` (§5.2).
 * Satu-satunya tempat yang boleh query langsung ke tabel `employees`.
 */
@Injectable()
export class EmployeeRepository implements IEmployeeRepository {
  constructor(@InjectRepository(Employee) private readonly repository: Repository<Employee>) {}

  // Relasi yang ikut di-load untuk tampilan (mis. Admin Dashboard butuh nama
  // cabang/departemen/jabatan, bukan UUID mentah). SENGAJA tidak memuat
  // relasi `user` — entity User punya kolom passwordHash, dan memuatnya di
  // sini akan membocorkan hash password lewat response API.
  private static readonly DISPLAY_RELATIONS = ['company', 'branch', 'department', 'position'];

  private getRepository(manager?: EntityManager): Repository<Employee> {
    return manager ? manager.getRepository(Employee) : this.repository;
  }

  async findAll({ page, limit }: PaginationParams): Promise<PaginatedResult<Employee>> {
    const [items, total] = await this.repository.findAndCount({
      relations: EmployeeRepository.DISPLAY_RELATIONS,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  findById(id: string): Promise<Employee | null> {
    return this.repository.findOne({ where: { id }, relations: EmployeeRepository.DISPLAY_RELATIONS });
  }

  findByUserId(userId: string): Promise<Employee | null> {
    return this.repository.findOne({ where: { userId }, relations: EmployeeRepository.DISPLAY_RELATIONS });
  }

  findByEmployeeCode(employeeCode: string): Promise<Employee | null> {
    return this.repository.findOne({ where: { employeeCode } });
  }

  findFirstByCompanyAndRole(companyId: string, role: UserRole): Promise<Employee | null> {
    return this.repository
      .createQueryBuilder('employee')
      .innerJoin('employee.user', 'user')
      .where('employee.company_id = :companyId', { companyId })
      .andWhere('user.role = :role', { role })
      .orderBy('employee.created_at', 'ASC')
      .getOne();
  }

  findActiveByCompany(companyId: string, branchId?: string, departmentId?: string): Promise<Employee[]> {
    return this.repository.find({
      where: {
        companyId,
        status: EmployeeStatus.ACTIVE,
        ...(branchId ? { branchId } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      relations: EmployeeRepository.DISPLAY_RELATIONS,
    });
  }

  create(data: DeepPartial<Employee>, manager?: EntityManager): Promise<Employee> {
    const repository = this.getRepository(manager);
    const employee = repository.create(data);
    return repository.save(employee);
  }

  async update(id: string, data: DeepPartial<Employee>): Promise<Employee> {
    await this.repository.update(id, data);
    return this.findById(id) as Promise<Employee>;
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }
}
