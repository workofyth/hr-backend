import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { PayrollItem } from './payroll-item.entity';
import { SalaryComponentType } from './salary-component.entity';

/**
 * payroll_item_details — backend-architecture-hr.md §5.5
 * Rincian per komponen untuk slip gaji transparan (gaji pokok, tunjangan,
 * lembur, potongan unpaid leave, BPJS, PPh21, dst — masing-masing satu
 * baris). Dipakai GET /payroll/:id/detail; render PDF slip menyusul saat
 * job queue/PDF renderer tersedia (belum bagian dari tugas ini).
 */
@Entity('payroll_item_details')
export class PayrollItemDetail extends BaseEntity {
  @Column({ type: 'uuid' })
  payrollItemId: string;

  @ManyToOne(() => PayrollItem)
  @JoinColumn({ name: 'payroll_item_id' })
  payrollItem: PayrollItem;

  @Column({ type: 'varchar' })
  componentName: string;

  @Column({ type: 'enum', enum: SalaryComponentType })
  componentType: SalaryComponentType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: string;
}
