import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Attendance } from './attendance.entity';
import { Employee } from '../../employee/entities/employee.entity';

export enum AttendanceCorrectionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * attendance_corrections — backend-architecture-hr.md §5.3
 * Pengajuan koreksi absensi (lupa absen, GPS error) — roadmap Phase 2.
 * `attendance_id` nullable: karyawan bisa mengajukan koreksi untuk hari yang
 * sama sekali tidak punya baris `attendances` (alpha karena lupa absen).
 */
@Entity('attendance_corrections')
export class AttendanceCorrection extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  attendanceId: string | null;

  @ManyToOne(() => Attendance, { nullable: true })
  @JoinColumn({ name: 'attendance_id' })
  attendance: Attendance | null;

  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'date' })
  requestedDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'timestamptz', nullable: true })
  requestedCheckIn: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  requestedCheckOut: Date | null;

  @Column({ type: 'enum', enum: AttendanceCorrectionStatus, default: AttendanceCorrectionStatus.PENDING })
  status: AttendanceCorrectionStatus;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: Employee | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
