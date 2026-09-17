import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Employee } from './employee.entity';
import { Shift } from '../../../database/entities/shift.entity';

/**
 * employee_shift_assignments — backend-architecture-hr.md §5.2
 */
@Entity('employee_shift_assignments')
export class EmployeeShiftAssignment extends BaseEntity {
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid' })
  shiftId: string;

  @ManyToOne(() => Shift)
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @Column({ type: 'date' })
  effectiveDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;
}
