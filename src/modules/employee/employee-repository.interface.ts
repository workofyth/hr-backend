import { DeepPartial, EntityManager } from 'typeorm';
import { Employee } from './entities/employee.entity';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Repository Pattern — backend-architecture-hr.md §3: EmployeeService
 * bergantung pada interface ini, bukan implementasi TypeORM konkret
 * (Dependency Inversion), supaya bisa di-unit-test dengan mock repository.
 */
export interface IEmployeeRepository {
  findAll(params: PaginationParams): Promise<PaginatedResult<Employee>>;
  findById(id: string): Promise<Employee | null>;
  findByEmployeeCode(employeeCode: string): Promise<Employee | null>;
  create(data: DeepPartial<Employee>, manager?: EntityManager): Promise<Employee>;
  update(id: string, data: DeepPartial<Employee>): Promise<Employee>;
  softDelete(id: string): Promise<void>;
}
