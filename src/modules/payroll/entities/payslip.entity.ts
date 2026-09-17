import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PayrollItem } from './payroll-item.entity';

/**
 * payslips — backend-architecture-hr.md §5.5.
 * Sama seperti `notifications`/`audit_logs` (§5.6), tabel ini HANYA punya
 * `generated_at` (bukan BaseEntity §5 penuh) — append-only, tidak pernah
 * diedit/di-soft-delete.
 */
@Entity('payslips')
export class Payslip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  payrollItemId: string;

  @ManyToOne(() => PayrollItem)
  @JoinColumn({ name: 'payroll_item_id' })
  payrollItem: PayrollItem;

  @Column({ type: 'varchar' })
  fileUrl: string;

  @Column({ type: 'timestamptz' })
  generatedAt: Date;
}
