import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Company } from '../../../database/entities/company.entity';
import { Employee } from '../../employee/entities/employee.entity';

export enum PayrollPeriodStatus {
  DRAFT = 'DRAFT',
  GENERATED = 'GENERATED',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  LOCKED = 'LOCKED',
}

/**
 * payroll_periods — backend-architecture-hr.md §5.5
 * UNIQUE(company_id, period_month, period_year) — satu periode payroll per
 * bulan per company (idempotency di level periode, checklist §4).
 */
@Entity('payroll_periods')
@Index(['companyId', 'periodMonth', 'periodYear'], { unique: true })
export class PayrollPeriod extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'int' })
  periodMonth: number;

  @Column({ type: 'int' })
  periodYear: number;

  @Column({ type: 'enum', enum: PayrollPeriodStatus, default: PayrollPeriodStatus.DRAFT })
  status: PayrollPeriodStatus;

  @Column({ type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approver: Employee | null;
}
