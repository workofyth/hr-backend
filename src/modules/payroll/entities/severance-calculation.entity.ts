import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';

/**
 * severance_calculations — backend-architecture-hr.md §5.5, "pesangon/PHK
 * sesuai PP 35/2021". Sama seperti `payslips`/`notifications` (§5.6),
 * tabel ini HANYA punya `calculated_at` (bukan BaseEntity §5 penuh) —
 * append-only, hitung ulang = baris baru (audit trail), bukan edit.
 */
@Entity('severance_calculations')
export class SeveranceCalculation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'date' })
  terminationDate: string;

  @Column({ type: 'varchar' })
  reason: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  yearsOfService: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  severancePay: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  serviceAppreciationPay: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  compensationPay: string;

  @Column({ type: 'timestamptz' })
  calculatedAt: Date;
}
