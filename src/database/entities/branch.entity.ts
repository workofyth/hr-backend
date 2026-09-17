import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Company } from './company.entity';

/**
 * branches — backend-architecture-hr.md §5.1
 * Titik lokasi kantor/cabang untuk validasi absensi radius (roadmap Phase 2).
 */
@Entity('branches')
export class Branch extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.branches)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: string;

  @Column({ type: 'int', default: 100 })
  radiusMeters: number;
}
