import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Company } from './company.entity';

/**
 * shifts — backend-architecture-hr.md §5.1
 * Contoh: "Shift Pagi", dengan toleransi keterlambatan dalam menit.
 */
@Entity('shifts')
export class Shift extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.shifts)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'int', default: 15 })
  toleranceMinutes: number;
}
