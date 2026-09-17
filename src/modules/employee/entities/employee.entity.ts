import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { Company } from '../../../database/entities/company.entity';
import { Branch } from '../../../database/entities/branch.entity';
import { Department } from '../../../database/entities/department.entity';
import { Position } from '../../../database/entities/position.entity';
import { encryptedColumn } from '../../../common/utils/encryption.util';

export enum EmploymentType {
  PKWTT = 'PKWTT',
  PKWT = 'PKWT',
  HARIAN = 'HARIAN',
  MAGANG = 'MAGANG',
}

export enum MaritalStatus {
  TK = 'TK',
  K = 'K',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  RESIGNED = 'RESIGNED',
}

/**
 * employees — backend-architecture-hr.md §5.2
 * `nik`, `npwp`, `bankAccountNo` dienkripsi at-rest (AES-256-GCM) lewat
 * `encryptedColumn` transformer — checklist §7. Tipe kolom tetap varchar,
 * hanya isinya yang berbeda (ciphertext base64), jadi tidak mengubah skema.
 */
@Entity('employees')
export class Employee extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'uuid' })
  positionId: string;

  @ManyToOne(() => Position)
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ type: 'uuid', nullable: true })
  managerId: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: Employee | null;

  @Column({ type: 'varchar', unique: true })
  employeeCode: string;

  @Column({ type: 'varchar' })
  fullName: string;

  @Column({ type: 'varchar', transformer: encryptedColumn })
  nik: string;

  @Column({ type: 'varchar', nullable: true, transformer: encryptedColumn })
  npwp: string | null;

  @Column({ type: 'varchar', transformer: encryptedColumn })
  bankAccountNo: string;

  @Column({ type: 'varchar' })
  bankName: string;

  @Column({ type: 'enum', enum: EmploymentType })
  employmentType: EmploymentType;

  @Column({ type: 'date' })
  joinDate: string;

  @Column({ type: 'date', nullable: true })
  resignDate: string | null;

  @Column({ type: 'enum', enum: MaritalStatus })
  maritalStatus: MaritalStatus;

  @Column({ type: 'int', default: 0 })
  dependentsCount: number;

  @Column({ type: 'enum', enum: EmployeeStatus })
  status: EmployeeStatus;
}
