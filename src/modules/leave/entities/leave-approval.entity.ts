import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { LeaveRequest } from './leave-request.entity';
import { Employee } from '../../employee/entities/employee.entity';

export enum LeaveApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * leave_approvals — backend-architecture-hr.md §5.4
 * Satu baris per level approval (Chain of Responsibility, §3). Semua level
 * dibuat sekaligus saat pengajuan (approver di-resolve oleh
 * LeaveApprovalChainFactory), tapi hanya baris dengan
 * `level == leaveRequest.currentApprovalLevel` yang bisa diputuskan.
 */
@Entity('leave_approvals')
export class LeaveApproval extends BaseEntity {
  @Column({ type: 'uuid' })
  leaveRequestId: string;

  @ManyToOne(() => LeaveRequest)
  @JoinColumn({ name: 'leave_request_id' })
  leaveRequest: LeaveRequest;

  @Column({ type: 'uuid' })
  approverId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'approver_id' })
  approver: Employee;

  @Column({ type: 'int' })
  level: number;

  @Column({ type: 'enum', enum: LeaveApprovalStatus, default: LeaveApprovalStatus.PENDING })
  status: LeaveApprovalStatus;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  actedAt: Date | null;
}
