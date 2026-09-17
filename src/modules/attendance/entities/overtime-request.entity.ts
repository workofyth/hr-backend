import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Employee } from '../../employee/entities/employee.entity';

export enum OvertimeRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * overtime_requests — backend-architecture-hr.md §5.3.
 * Pengajuan lembur karyawan; dipakai `PayrollService.computeOvertimeHours`
 * sebagai basis jam lembur (hanya request berstatus APPROVED).
 */
@Entity('overtime_requests')
export class OvertimeRequest extends BaseEntity {
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: OvertimeRequestStatus, default: OvertimeRequestStatus.PENDING })
  status: OvertimeRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: Employee | null;
}
