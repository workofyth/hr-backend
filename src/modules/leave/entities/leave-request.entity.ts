import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Employee } from '../../employee/entities/employee.entity';
import { LeaveType } from './leave-type.entity';

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * leave_requests — backend-architecture-hr.md §5.4
 * `currentApprovalLevel` menunjuk level `leave_approvals` yang sedang
 * menunggu keputusan (Chain of Responsibility, §3: atasan langsung -> HR).
 * Index (employee_id, status) sesuai catatan indexing §5 — query riwayat &
 * dashboard approval sering difilter kombinasi ini.
 */
@Entity('leave_requests')
@Index(['employeeId', 'status'])
export class LeaveRequest extends BaseEntity {
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

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  totalDays: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'enum', enum: LeaveRequestStatus, default: LeaveRequestStatus.PENDING })
  status: LeaveRequestStatus;

  @Column({ type: 'int', default: 1 })
  currentApprovalLevel: number;
}
