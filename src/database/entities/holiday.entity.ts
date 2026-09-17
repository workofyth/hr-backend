import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Company } from './company.entity';

/**
 * holidays — backend-architecture-hr.md §5.1
 */
@Entity('holidays')
export class Holiday extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.holidays)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'boolean' })
  isNational: boolean;
}
