import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Employee } from '../../employee/entities/employee.entity';
import { LeaveType } from './leave-type.entity';

/**
 * leave_balances — backend-architecture-hr.md §5.4
 * Saldo cuti per (employee, leave_type, year) — roadmap Phase 3: "Saldo
 * cuti otomatis (accrual bulanan/tahunan), termasuk carry-over". Kolom
 * numerik disimpan sebagai decimal(5,2) via string (bukan float) — konsisten
 * dengan konvensi kolom desimal presisi di modul lain (mis. Attendance).
 */
@Entity('leave_balances')
@Index(['employeeId', 'leaveTypeId', 'year'], { unique: true })
export class LeaveBalance extends BaseEntity {
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid' })
  leaveTypeId: string;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  entitledDays: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  usedDays: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  carriedOverDays: string;
}
