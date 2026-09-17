import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Employee } from '../../employee/entities/employee.entity';
import { SalaryComponent } from './salary-component.entity';

/**
 * employee_salary_structures — backend-architecture-hr.md §5.5
 * Struktur & skala upah per karyawan (roadmap Phase 4, wajib sesuai PP
 * 36/2021). `endDate` nullable — komponen yang masih berlaku belum punya
 * tanggal akhir.
 */
@Entity('employee_salary_structures')
export class EmployeeSalaryStructure extends BaseEntity {
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid' })
  salaryComponentId: string;

  @ManyToOne(() => SalaryComponent)
  @JoinColumn({ name: 'salary_component_id' })
  salaryComponent: SalaryComponent;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: string;

  @Column({ type: 'date' })
  effectiveDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;
}
