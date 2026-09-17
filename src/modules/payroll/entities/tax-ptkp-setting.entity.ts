import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';

/**
 * tax_ptkp_settings — backend-architecture-hr.md §5.5
 * Master PTKP (status 'TK0','K0','K1', dst), histori per `effectiveYear` —
 * checklist §7: "tidak pernah hardcode di kode". `annualAmount` dipakai
 * untuk rekonsiliasi tahunan PPh21 (belum diimplementasikan pada fase ini,
 * lihat catatan di Pph21Calculator); tabel ini tetap wajib diisi karena
 * `status` yang tercatat di sini adalah acuan bahwa PTKP karyawan sudah
 * dikonfigurasi untuk tahun berjalan sebelum payroll di-generate.
 */
@Entity('tax_ptkp_settings')
export class TaxPtkpSetting extends BaseEntity {
  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  annualAmount: string;

  @Column({ type: 'int' })
  effectiveYear: number;
}
