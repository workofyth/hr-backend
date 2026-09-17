import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Company } from './company.entity';

/**
 * positions — backend-architecture-hr.md §5.1
 */
@Entity('positions')
export class Position extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.positions)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'int' })
  level: number;
}
