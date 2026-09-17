import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

export { UserRole };

/**
 * users — backend-architecture-hr.md §5.2
 * Kredensial login & role RBAC. Detail data karyawan ada di entity `Employee`.
 */
@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', unique: true })
  phone: string;

  @Column({ type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
