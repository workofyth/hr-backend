import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { PayrollPeriod } from './payroll-period.entity';
import { Employee } from '../../employee/entities/employee.entity';

/**
 * payroll_items — backend-architecture-hr.md §5.5
 * UNIQUE(payroll_period_id, employee_id) — mencegah duplikasi data jika
 * endpoint generate dipanggil lebih dari sekali untuk periode yang sama
 * (checklist §4 "Idempotency"), sesuai permintaan eksplisit tugas ini.
 * Index (payroll_period_id) sesuai catatan indexing §5.
 */
@Entity('payroll_items')
@Index(['payrollPeriodId', 'employeeId'], { unique: true })
@Index(['payrollPeriodId'])
export class PayrollItem extends BaseEntity {
  @Column({ type: 'uuid' })
  payrollPeriodId: string;

  @ManyToOne(() => PayrollPeriod)
  @JoinColumn({ name: 'payroll_period_id' })
  payrollPeriod: PayrollPeriod;

  @Column({ type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  grossSalary: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalOvertime: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeductionUnpaid: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  bpjsCompanyTotal: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  bpjsEmployeeTotal: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  pph21Amount: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  netSalary: string;
}
