import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Company } from '../../../database/entities/company.entity';

export enum SalaryComponentType {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
}

/**
 * salary_components — backend-architecture-hr.md §5.5
 * Master komponen gaji (roadmap Phase 4: "gaji pokok, tunjangan tetap/tidak
 * tetap, transport, makan, jabatan"). Data referensi per company — dikelola
 * lewat migration/SQL manual untuk saat ini, mengikuti pola yang sama
 * dipakai `organization`/`leave_types` (§2) sampai ada kebutuhan CRUD penuh.
 */
@Entity('salary_components')
export class SalaryComponent extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'enum', enum: SalaryComponentType })
  type: SalaryComponentType;

  @Column({ type: 'boolean' })
  isTaxable: boolean;

  @Column({ type: 'boolean' })
  isFixed: boolean;
}
