import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Employee } from './employee.entity';

/**
 * employee_documents — backend-architecture-hr.md §5.2
 * type: 'KTP', 'KONTRAK', 'IJAZAH', dst.
 */
@Entity('employee_documents')
export class EmployeeDocument extends BaseEntity {
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  fileUrl: string;

  @Column({ type: 'timestamptz' })
  uploadedAt: Date;
}
