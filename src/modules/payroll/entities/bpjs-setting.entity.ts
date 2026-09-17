import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';

export enum BpjsType {
  JHT = 'JHT',
  JKK = 'JKK',
  JKM = 'JKM',
  JP = 'JP',
  KESEHATAN = 'KESEHATAN',
}

/**
 * bpjs_settings — backend-architecture-hr.md §5.5
 * Persentase iuran BPJS Ketenagakerjaan (JHT/JKK/JKM/JP) & BPJS Kesehatan,
 * histori per `effectiveDate`. `maxSalaryBase` nullable — sebagian jenis
 * iuran punya batas atas upah pelaporan, sebagian tidak.
 */
@Entity('bpjs_settings')
export class BpjsSetting extends BaseEntity {
  @Column({ type: 'enum', enum: BpjsType })
  type: BpjsType;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  companyPercentage: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  employeePercentage: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxSalaryBase: string | null;

  @Column({ type: 'date' })
  effectiveDate: string;
}
