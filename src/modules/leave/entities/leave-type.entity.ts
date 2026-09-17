import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Company } from '../../../database/entities/company.entity';

/**
 * leave_types — backend-architecture-hr.md §5.4
 * Master jenis cuti/izin (roadmap Phase 3: "Cuti Tahunan","Cuti Sakit",
 * "Cuti Melahirkan", dst). Data referensi — dikelola lewat migration/seed,
 * bukan CRUD API, sampai ada kebutuhan pengelolaan penuh (§2 pola yang
 * sama dipakai untuk companies/branches/departments/positions).
 */
@Entity('leave_types')
export class LeaveType extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'boolean', default: true })
  isPaid: boolean;

  @Column({ type: 'int', nullable: true })
  defaultDaysPerYear: number | null;

  @Column({ type: 'boolean', default: false })
  requiresAttachment: boolean;
}
