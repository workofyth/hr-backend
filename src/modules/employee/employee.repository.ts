import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import {
  IEmployeeRepository,
  PaginatedResult,
  PaginationParams,
} from './employee-repository.interface';

/**
 * Implementasi Repository Pattern untuk tabel `employees` (§5.2).
 * Satu-satunya tempat yang boleh query langsung ke tabel `employees`.
 */
@Injectable()
export class EmployeeRepository implements IEmployeeRepository {
  constructor(@InjectRepository(Employee) private readonly repository: Repository<Employee>) {}

  private getRepository(manager?: EntityManager): Repository<Employee> {
    return manager ? manager.getRepository(Employee) : this.repository;
  }

  async findAll({ page, limit }: PaginationParams): Promise<PaginatedResult<Employee>> {
    const [items, total] = await this.repository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  findById(id: string): Promise<Employee | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByEmployeeCode(employeeCode: string): Promise<Employee | null> {
    return this.repository.findOne({ where: { employeeCode } });
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
