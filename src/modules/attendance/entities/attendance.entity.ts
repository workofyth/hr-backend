import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Employee } from '../../employee/entities/employee.entity';
import { Branch } from '../../../database/entities/branch.entity';
import { Shift } from '../../../database/entities/shift.entity';

export enum AttendanceStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
  EARLY_LEAVE = 'EARLY_LEAVE',
  ABSENT = 'ABSENT',
  ON_LEAVE = 'ON_LEAVE',
  WFH = 'WFH',
}

/**
 * attendances — backend-architecture-hr.md §5.3
 * Satu baris per (employee, attendance_date) — lihat UNIQUE constraint di
 * migration. Kolom lat/lng/distance check-in dan check-out disimpan untuk
 * audit trail lokasi absen (roadmap Phase 2: "Log lokasi absen untuk audit,
 * bukan tracking terus-menerus"), BUKAN hasil perhitungan dari client —
 * jarak selalu dihitung ulang server-side lewat GeofenceValidationStrategy.
 */
@Entity('attendances')
@Index(['employeeId', 'attendanceDate'], { unique: true })
export class Attendance extends BaseEntity {
  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'uuid' })
  shiftId: string;

  @ManyToOne(() => Shift)
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @Column({ type: 'date' })
  attendanceDate: string;

  @Column({ type: 'timestamptz', nullable: true })
  checkInTime: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkInLat: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkInLng: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  checkInDistanceMeters: string | null;

  @Column({ type: 'varchar', nullable: true })
  checkInPhotoUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkOutTime: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkOutLat: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkOutLng: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  checkOutDistanceMeters: string | null;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status: AttendanceStatus;

  @Column({ type: 'int', nullable: true })
  workDurationMinutes: number | null;
}
