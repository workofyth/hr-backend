import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';

/**
 * tax_ter_rates — backend-architecture-hr.md §5.5
 * Tabel TER (Tarif Efektif Rata-rata) PPh21 bulanan, berlaku sejak 2024
 * (PMK 168/2023), histori per `effectiveYear`. `incomeTo` tidak nullable
 * sesuai skema dokumen — bracket teratas diisi dengan angka besar sebagai
 * batas atas terbuka (data seed, bukan hardcode di kode kalkulator).
 */
@Entity('tax_ter_rates')
export class TaxTerRate extends BaseEntity {
  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  incomeFrom: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  incomeTo: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  rate: string;

  @Column({ type: 'int' })
  effectiveYear: number;
}
