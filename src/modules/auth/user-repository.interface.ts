import { EntityManager } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

export interface CreateUserData {
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
}

/**
 * Repository Pattern — backend-architecture-hr.md §3: Service (AuthService,
 * EmployeeService) bergantung pada interface ini (Dependency Inversion),
 * bukan pada implementasi TypeORM konkret.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmailOrPhone(emailOrPhone: string): Promise<User | null>;
  create(data: CreateUserData, manager?: EntityManager): Promise<User>;
  updateLastLogin(id: string, date: Date): Promise<void>;
}
